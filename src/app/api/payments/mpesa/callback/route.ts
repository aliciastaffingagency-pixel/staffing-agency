import { timingSafeEqual } from 'node:crypto'
import type { NextRequest } from 'next/server'
import { settleMpesa } from '@/lib/payments'
import type { Json } from '@/lib/supabase/database.types'

type StkCallback = {
  Body?: {
    stkCallback?: {
      CheckoutRequestID?: string
      ResultCode?: number
      ResultDesc?: string
      CallbackMetadata?: { Item?: { Name: string; Value?: string | number }[] }
    }
  }
}

function secretOk(given: string | null) {
  const expected = process.env.MPESA_CALLBACK_SECRET
  if (!expected || !given) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(given)
  return a.length === b.length && timingSafeEqual(a, b)
}

// Safaricom posts the STK Push result here. Daraja callbacks aren't signed, so the
// URL carries a secret, and the CheckoutRequestID must match a payment we started.
export async function POST(request: NextRequest) {
  if (!secretOk(request.nextUrl.searchParams.get('secret'))) {
    return Response.json({ ResultCode: 1, ResultDesc: 'Rejected' }, { status: 401 })
  }
  const body = (await request.json().catch(() => null)) as StkCallback | null
  const cb = body?.Body?.stkCallback
  if (!cb?.CheckoutRequestID || cb.ResultCode == null) {
    return Response.json({ ResultCode: 1, ResultDesc: 'Malformed callback' }, { status: 400 })
  }
  const item = (name: string) => cb.CallbackMetadata?.Item?.find((i) => i.Name === name)?.Value
  const result = await settleMpesa({
    checkoutRequestId: cb.CheckoutRequestID,
    resultCode: Number(cb.ResultCode),
    resultDesc: cb.ResultDesc,
    receipt: item('MpesaReceiptNumber') != null ? String(item('MpesaReceiptNumber')) : null,
    amount: item('Amount') != null ? Number(item('Amount')) : null,
    raw: body as unknown as Json,
  })
  if (!result.ok) console.warn('mpesa callback not applied:', result.reason)
  // Always acknowledge so Safaricom stops retrying.
  return Response.json({ ResultCode: 0, ResultDesc: 'Accepted' })
}
