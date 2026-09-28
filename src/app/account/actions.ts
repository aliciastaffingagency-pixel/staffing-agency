'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { FormState } from '@/components/ui/form'
import { requireRole } from '@/lib/auth'
import { advanceContract } from '@/lib/contracts'
import { notify } from '@/lib/notify'
import { queryStk, settleMpesa, startCardPayment, startMpesaPayment } from '@/lib/payments'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { normalizeKePhone } from '@/lib/utils'

// Loads a contract through the CLIENT's own RLS view: if they can't read it, they can't act on it.
async function myContract(contractId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('contracts')
    .select('id, agency_id, status, client_signed_at, booking_request_id, booking_requests(client_id, clients(name))')
    .eq('id', contractId)
    .maybeSingle()
  return data
}

export async function signContract(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole('client')
  const parsed = z
    .object({
      contract_id: z.uuid(),
      signature: z.string().trim().min(3, 'Type your full name to sign').max(120),
      agree: z.literal(true, 'Tick the box to confirm you agree to the terms'),
    })
    .safeParse({ contract_id: formData.get('contract_id'), signature: formData.get('signature'), agree: formData.get('agree') === 'on' })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const contract = await myContract(parsed.data.contract_id)
  if (!contract) return { error: 'Contract not found' }
  if (contract.status !== 'sent' || contract.client_signed_at) return { error: 'This contract is not open for signing.' }

  const { error } = await createAdminClient()
    .from('contracts')
    .update({ client_signature: parsed.data.signature, client_signed_at: new Date().toISOString(), client_ip: await clientIp() })
    .eq('id', contract.id)
    .eq('status', 'sent')
  if (error) return { error: error.message }

  await advanceContract(contract.id)
  await notify({
    agencyId: contract.agency_id,
    role: 'super_admin',
    type: 'contract_signed',
    subject: 'Contract signed by client',
    message: `${contract.booking_requests?.clients?.name ?? 'A client'} signed their contract. Please countersign.`,
    link: `/admin/bookings/${contract.booking_request_id}`,
  })
  revalidatePath(`/account/bookings/${contract.booking_request_id}`)
  return { message: 'Signed! You can now pay the agency fee to confirm your placement.' }
}

export async function payWithMpesa(_prev: FormState, formData: FormData): Promise<FormState & { started?: boolean }> {
  const session = await requireRole('client')
  const contractId = z.uuid().safeParse(formData.get('contract_id'))
  const phone = normalizeKePhone(String(formData.get('phone') ?? ''))
  if (!contractId.success) return { error: 'Contract not found' }
  if (!phone) return { error: 'Enter the M-Pesa phone number, e.g. 0712 345 678' }
  if (!(await rateLimit('mpesa-stk', 6, 600, session.id))) return { error: 'Too many payment attempts. Please wait a few minutes.' }

  const contract = await myContract(contractId.data)
  if (!contract) return { error: 'Contract not found' }
  try {
    const res = await startMpesaPayment(contract.id, phone)
    revalidatePath(`/account/bookings/${contract.booking_request_id}`)
    return { started: true, message: `${res.message}. Enter your M-Pesa PIN on ${phone} to pay.` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not start the M-Pesa payment' }
  }
}

export async function payWithCard(formData: FormData) {
  const session = await requireRole('client')
  const contract = await myContract(z.uuid().parse(formData.get('contract_id')))
  if (!contract || !session.email) return
  const url = await startCardPayment(contract.id, session.email)
  redirect(url)
}

// Pulls the result from Safaricom if the callback hasn't arrived yet.
export async function checkPayment(formData: FormData) {
  await requireRole('client')
  const contract = await myContract(z.uuid().parse(formData.get('contract_id')))
  if (!contract) return
  const admin = createAdminClient()
  const { data: pending } = await admin
    .from('payments')
    .select('mpesa_checkout_request_id')
    .eq('contract_id', contract.id)
    .eq('status', 'processing')
    .not('mpesa_checkout_request_id', 'is', null)
  for (const p of pending ?? []) {
    const result = await queryStk(p.mpesa_checkout_request_id!)
    if (result) await settleMpesa({ checkoutRequestId: p.mpesa_checkout_request_id!, resultCode: result.resultCode, resultDesc: result.resultDesc })
  }
  revalidatePath(`/account/bookings/${contract.booking_request_id}`)
}

export async function cancelMyBooking(formData: FormData) {
  await requireRole('client')
  const bookingId = z.uuid().parse(formData.get('booking_id'))
  const supabase = await createClient()
  const { data } = await supabase
    .from('booking_requests')
    .update({ status: 'cancelled', cancelled_reason: 'Cancelled by client' })
    .eq('id', bookingId)
    .in('status', ['pending', 'matched'])
    .select('agency_id')
    .maybeSingle()
  if (data) {
    // Any unsigned contract goes with it.
    await createAdminClient().from('contracts').update({ status: 'cancelled' }).eq('booking_request_id', bookingId).eq('status', 'sent')
    await notify({ agencyId: data.agency_id, role: 'super_admin', type: 'booking_update', message: 'A client cancelled their booking request.', link: `/admin/bookings/${bookingId}` })
  }
  revalidatePath('/account', 'layout')
}
