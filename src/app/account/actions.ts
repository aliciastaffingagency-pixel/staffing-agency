'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { FormState } from '@/components/ui/form'
import { requireRole } from '@/lib/auth'
import { notify } from '@/lib/notify'
import { queryStk, settleMpesa, startCardPayment } from '@/lib/payments'
import { clientIp } from '@/lib/rate-limit'
import { payMpesaOp, signContractOp } from '@/lib/services/client-ops'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// Loads a contract through the CLIENT's own RLS view: if they can't read it, they can't act on it.
async function myContract(contractId: string) {
  const supabase = await createClient()
  const { data } = await supabase.from('contracts').select('id, booking_request_id').eq('id', contractId).maybeSingle()
  return data
}

export async function signContract(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('client')
  const res = await signContractOp({ supabase: await createClient(), session }, Object.fromEntries(formData), await clientIp())
  if (res.error !== undefined) return { error: res.error }
  revalidatePath(`/account/bookings/${res.bookingId}`)
  return { message: 'Signed! You can now pay the agency fee to confirm your placement.' }
}

export async function payWithMpesa(_prev: FormState, formData: FormData): Promise<FormState & { started?: boolean }> {
  const session = await requireRole('client')
  const res = await payMpesaOp({ supabase: await createClient(), session }, Object.fromEntries(formData))
  if (res.error !== undefined) return { error: res.error }
  revalidatePath(`/account/bookings/${res.bookingId}`)
  return { started: true, message: res.message }
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
