import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { advanceContract } from '@/lib/contracts'
import { notify, notifyClient } from '@/lib/notify'
import { siteUrl } from '@/lib/site-url'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/database.types'
import { formatKes } from '@/lib/utils'

const SITE = siteUrl

// ===========================================================================
// M-Pesa Daraja — STK Push ("Lipa na M-Pesa Online")
//   MPESA_ENV = sandbox | production | simulate (simulate: dev only, no Safaricom call)
// ===========================================================================
type MpesaMode = 'sandbox' | 'production' | 'simulate' | null

export function mpesaMode(): MpesaMode {
  const env = process.env.MPESA_ENV
  if (env === 'simulate') return process.env.NODE_ENV === 'production' ? null : 'simulate'
  if (!process.env.MPESA_CONSUMER_KEY || !process.env.MPESA_CONSUMER_SECRET || !process.env.MPESA_SHORTCODE || !process.env.MPESA_PASSKEY) return null
  return env === 'production' ? 'production' : 'sandbox'
}

const darajaBase = () => (mpesaMode() === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke')

async function darajaToken() {
  const auth = Buffer.from(`${process.env.MPESA_CONSUMER_KEY}:${process.env.MPESA_CONSUMER_SECRET}`).toString('base64')
  const res = await fetch(`${darajaBase()}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`M-Pesa auth failed (${res.status})`)
  return ((await res.json()) as { access_token: string }).access_token
}

// Daraja wants East Africa Time as YYYYMMDDHHmmss.
function darajaTimestamp() {
  const eat = new Date(Date.now() + 3 * 3600 * 1000)
  return eat.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)
}

function darajaPassword(ts: string) {
  return Buffer.from(`${process.env.MPESA_SHORTCODE}${process.env.MPESA_PASSKEY}${ts}`).toString('base64')
}

export function mpesaCallbackUrl() {
  const base = process.env.MPESA_CALLBACK_BASE_URL ?? SITE()
  return `${base}/api/payments/mpesa/callback?secret=${encodeURIComponent(process.env.MPESA_CALLBACK_SECRET ?? '')}`
}

async function stkPush(input: { phone: string; amount: number; reference: string; description: string }) {
  const mode = mpesaMode()
  if (!mode) throw new Error('M-Pesa is not configured')
  if (mode === 'simulate') return { checkoutRequestId: `ws_CO_SIM_${crypto.randomUUID()}`, message: 'Simulated STK push sent' }

  const ts = darajaTimestamp()
  const res = await fetch(`${darajaBase()}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await darajaToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: process.env.MPESA_SHORTCODE,
      Password: darajaPassword(ts),
      Timestamp: ts,
      TransactionType: process.env.MPESA_TRANSACTION_TYPE ?? 'CustomerPayBillOnline',
      Amount: Math.ceil(input.amount),
      PartyA: input.phone.replace(/^\+/, ''),
      PartyB: process.env.MPESA_PARTY_B ?? process.env.MPESA_SHORTCODE,
      PhoneNumber: input.phone.replace(/^\+/, ''),
      CallBackURL: mpesaCallbackUrl(),
      AccountReference: input.reference.slice(0, 12),
      TransactionDesc: input.description.slice(0, 13),
    }),
    cache: 'no-store',
  })
  const body = (await res.json().catch(() => ({}))) as { CheckoutRequestID?: string; CustomerMessage?: string; errorMessage?: string; ResponseCode?: string }
  if (!res.ok || body.ResponseCode !== '0' || !body.CheckoutRequestID) {
    throw new Error(body.errorMessage ?? body.CustomerMessage ?? `M-Pesa request failed (${res.status})`)
  }
  return { checkoutRequestId: body.CheckoutRequestID, message: body.CustomerMessage ?? 'Check your phone to complete payment' }
}

// Asks Safaricom for the result when the callback is slow or never arrives.
export async function queryStk(checkoutRequestId: string): Promise<{ resultCode: number; resultDesc: string } | null> {
  const mode = mpesaMode()
  if (!mode || mode === 'simulate') return null
  const ts = darajaTimestamp()
  const res = await fetch(`${darajaBase()}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await darajaToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ BusinessShortCode: process.env.MPESA_SHORTCODE, Password: darajaPassword(ts), Timestamp: ts, CheckoutRequestID: checkoutRequestId }),
    cache: 'no-store',
  })
  const body = (await res.json().catch(() => ({}))) as { ResultCode?: string; ResultDesc?: string }
  if (body.ResultCode == null) return null // still processing
  return { resultCode: Number(body.ResultCode), resultDesc: body.ResultDesc ?? '' }
}

// ===========================================================================
// Paystack — card payments (supports KES)
// ===========================================================================
export const paystackEnabled = () => Boolean(process.env.PAYSTACK_SECRET_KEY)

async function paystack<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://api.paystack.co${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    cache: 'no-store',
  })
  const body = (await res.json()) as { status: boolean; message: string; data: T }
  if (!res.ok || !body.status) throw new Error(body.message || `Paystack error ${res.status}`)
  return body.data
}

export function verifyPaystackSignature(raw: string, signature: string | null) {
  if (!signature || !process.env.PAYSTACK_SECRET_KEY) return false
  const expected = createHmac('sha512', process.env.PAYSTACK_SECRET_KEY).update(raw).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && timingSafeEqual(a, b)
}

// ===========================================================================
// Shared payment bookkeeping (service role)
// ===========================================================================
export async function outstandingFor(contractId: string) {
  const admin = createAdminClient()
  const [{ data: contract }, { data: paid }] = await Promise.all([
    admin.from('contracts').select('id, agency_id, amount_due, status, booking_request_id, booking_requests(client_id)').eq('id', contractId).single(),
    admin.from('payments').select('amount').eq('contract_id', contractId).eq('status', 'paid'),
  ])
  if (!contract) return null
  const paidTotal = (paid ?? []).reduce((s, p) => s + Number(p.amount), 0)
  return { contract, paidTotal, outstanding: Math.max(0, Number(contract.amount_due ?? 0) - paidTotal) }
}

export async function startMpesaPayment(contractId: string, phone: string) {
  const info = await outstandingFor(contractId)
  if (!info) throw new Error('Contract not found')
  if (!['client_signed', 'fully_signed', 'active'].includes(info.contract.status)) throw new Error('Sign the contract before paying')
  if (info.outstanding <= 0) throw new Error('Nothing left to pay on this contract')

  const admin = createAdminClient()
  // Don't fire a second prompt while one is still waiting on the phone.
  const { data: waiting } = await admin
    .from('payments')
    .select('id, created_at')
    .eq('contract_id', contractId)
    .eq('status', 'processing')
    .gte('created_at', new Date(Date.now() - 90_000).toISOString())
    .limit(1)
  if (waiting?.length) throw new Error('A payment prompt was just sent. Check your phone, or try again in a minute.')

  const push = await stkPush({ phone, amount: info.outstanding, reference: `ASA${contractId.slice(0, 8)}`, description: 'Placement fee' })
  const { data: payment, error } = await admin
    .from('payments')
    .insert({
      agency_id: info.contract.agency_id,
      contract_id: contractId,
      amount: Math.ceil(info.outstanding),
      method: 'mpesa',
      payer_phone: phone,
      mpesa_checkout_request_id: push.checkoutRequestId,
      status: 'processing',
    })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return { paymentId: payment.id, message: push.message, checkoutRequestId: push.checkoutRequestId }
}

// Applies an M-Pesa result (from the callback or an STK query). Idempotent.
export async function settleMpesa(input: { checkoutRequestId: string; resultCode: number; resultDesc?: string; receipt?: string | null; amount?: number | null; raw?: Json }) {
  const admin = createAdminClient()
  const { data: payment } = await admin
    .from('payments')
    .select('id, contract_id, amount, status, agency_id')
    .eq('mpesa_checkout_request_id', input.checkoutRequestId)
    .maybeSingle()
  if (!payment) return { ok: false, reason: 'unknown checkout request' }
  if (payment.status === 'paid' || payment.status === 'failed') return { ok: true, reason: 'already settled' }

  if (input.resultCode === 0) {
    if (input.amount != null && Math.round(input.amount) < Math.round(Number(payment.amount))) {
      await admin.from('payments').update({ status: 'failed', raw_callback: input.raw ?? null }).eq('id', payment.id)
      return { ok: false, reason: 'amount mismatch' }
    }
    await admin
      .from('payments')
      .update({ status: 'paid', paid_at: new Date().toISOString(), mpesa_receipt: input.receipt ?? null, raw_callback: input.raw ?? null })
      .eq('id', payment.id)
    await afterPaid(payment.contract_id, Number(payment.amount), payment.agency_id, `M-Pesa ${input.receipt ?? ''}`.trim())
  } else {
    await admin.from('payments').update({ status: 'failed', raw_callback: input.raw ?? { ResultDesc: input.resultDesc ?? '' } }).eq('id', payment.id)
  }
  return { ok: true }
}

export async function startCardPayment(contractId: string, email: string) {
  if (!paystackEnabled()) throw new Error('Card payments are not set up yet')
  const info = await outstandingFor(contractId)
  if (!info) throw new Error('Contract not found')
  if (info.outstanding <= 0) throw new Error('Nothing left to pay on this contract')
  if (!['client_signed', 'fully_signed', 'active'].includes(info.contract.status)) throw new Error('Sign the contract before paying')

  const reference = `asa_${contractId.slice(0, 8)}_${Date.now().toString(36)}`
  const admin = createAdminClient()
  const { error } = await admin.from('payments').insert({
    agency_id: info.contract.agency_id,
    contract_id: contractId,
    amount: Math.ceil(info.outstanding),
    method: 'card',
    card_ref: reference,
    status: 'pending',
  })
  if (error) throw new Error(error.message)

  const data = await paystack<{ authorization_url: string }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email,
      amount: Math.ceil(info.outstanding) * 100, // lowest currency unit
      currency: 'KES',
      reference,
      callback_url: `${SITE()}/api/payments/paystack/return`,
      metadata: { contract_id: contractId },
    }),
  })
  return data.authorization_url
}

// Verifies with Paystack (never trusts the redirect alone). Idempotent.
export async function settleCard(reference: string) {
  const admin = createAdminClient()
  const { data: payment } = await admin.from('payments').select('id, contract_id, amount, status, agency_id').eq('card_ref', reference).maybeSingle()
  if (!payment) return { ok: false as const, contractId: null }
  if (payment.status === 'paid') return { ok: true as const, contractId: payment.contract_id }

  const tx = await paystack<{ status: string; amount: number; currency: string }>(`/transaction/verify/${encodeURIComponent(reference)}`)
  if (tx.status === 'success' && tx.currency === 'KES' && tx.amount >= Math.round(Number(payment.amount) * 100)) {
    await admin.from('payments').update({ status: 'paid', paid_at: new Date().toISOString(), raw_callback: tx as unknown as Json }).eq('id', payment.id)
    await afterPaid(payment.contract_id, Number(payment.amount), payment.agency_id, 'card')
    return { ok: true as const, contractId: payment.contract_id }
  }
  if (tx.status === 'failed' || tx.status === 'abandoned') {
    await admin.from('payments').update({ status: 'failed', raw_callback: tx as unknown as Json }).eq('id', payment.id)
  }
  return { ok: false as const, contractId: payment.contract_id }
}

export async function afterPaid(contractId: string, amount: number, agencyId: string, how: string) {
  const info = await outstandingFor(contractId)
  await advanceContract(contractId)
  const clientId = info?.contract.booking_requests?.client_id
  const bookingId = info?.contract.booking_request_id
  if (clientId) {
    await notifyClient(clientId, {
      agencyId,
      type: 'payment_received',
      subject: 'Payment received',
      message: `We received your payment of ${formatKes(amount)} (${how}). Thank you!`,
      link: `/account/bookings/${bookingId}`,
      sms: true,
    })
  }
  await notify({
    agencyId,
    role: 'super_admin',
    type: 'payment_received',
    message: `Payment of ${formatKes(amount)} received (${how}).`,
    link: '/admin/payments',
  })
}
