'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { FormState } from '@/components/ui/form'
import { getAgency } from '@/lib/agency'
import { requireRole } from '@/lib/auth'
import { advanceContract, buildValues, generateContractPdf, renderTemplate, type TemplateDefaults } from '@/lib/contracts'
import { notifyClient } from '@/lib/notify'
import { afterPaid } from '@/lib/payments'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { formatKes } from '@/lib/utils'

const refresh = (bookingId: string) => {
  revalidatePath(`/admin/bookings/${bookingId}`)
  // Placing or freeing staff changes their availability on the public pages.
  revalidatePath('/', 'layout')
}

const money = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : Number(v.replace(/[,\s]/g, ''))))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 10_000_000), `Enter a valid ${label}`)

export async function assignStaff(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('super_admin')
  const bookingId = z.uuid().parse(formData.get('booking_id'))
  const staffId = z.uuid().safeParse(formData.get('staff_id'))
  if (!staffId.success) return { error: 'Choose a staff member' }

  const supabase = await createClient()
  const [{ data: booking }, { data: staff }] = await Promise.all([
    supabase.from('booking_requests').select('id, status, client_id, agency_id').eq('id', bookingId).single(),
    supabase.from('staff_profiles').select('id, full_name, category_id, agency_id, staff_categories(name)').eq('id', staffId.data).single(),
  ])
  if (!booking || !staff || staff.agency_id !== session.agency_id) return { error: 'Not found' }
  if (!['pending', 'matched'].includes(booking.status)) return { error: 'This booking already has a contract. Cancel it first to change staff.' }

  const { error } = await supabase
    .from('booking_requests')
    .update({ staff_id: staff.id, category_id: staff.category_id, status: 'matched' })
    .eq('id', bookingId)
  if (error) return { error: error.message }

  await notifyClient(booking.client_id, {
    agencyId: booking.agency_id,
    type: 'matched',
    subject: 'We found your match',
    message: `Good news! We've matched you with ${staff.full_name} (${staff.staff_categories?.name}). Your contract will follow shortly.`,
    link: `/account/bookings/${bookingId}`,
    sms: true,
  })
  refresh(bookingId)
  return { message: `${staff.full_name} assigned. The client has been notified.` }
}

export async function cancelBooking(formData: FormData) {
  await requireRole('super_admin')
  const bookingId = z.uuid().parse(formData.get('booking_id'))
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500) || null
  const supabase = await createClient()
  const { data: open } = await supabase.from('contracts').select('id, status').eq('booking_request_id', bookingId).not('status', 'in', '(cancelled,ended)')
  if (open?.some((c) => c.status === 'active')) return // end the placement instead
  if (open?.length) await supabase.from('contracts').update({ status: 'cancelled' }).in('id', open.map((c) => c.id))
  const { data: b } = await supabase.from('booking_requests').update({ status: 'cancelled', cancelled_reason: reason }).eq('id', bookingId).select('client_id, agency_id').single()
  if (b) {
    await notifyClient(b.client_id, {
      agencyId: b.agency_id,
      type: 'booking_update',
      message: `Your booking request was cancelled${reason ? `: ${reason}` : '.'}`,
      link: `/account/bookings/${bookingId}`,
    })
  }
  refresh(bookingId)
}

const contractSchema = z.object({
  booking_id: z.uuid(),
  rate: money('rate'),
  rate_period: z.enum(['day', 'month']),
  starts_on: z.union([z.iso.date(), z.literal('')]).transform((v) => v || null),
  ends_on: z.union([z.iso.date(), z.literal('')]).transform((v) => v || null),
  amount_due: money('agency fee').refine((v) => v !== null, 'Enter the agency fee (0 if none)'),
  duties: z.string().trim().max(3000).transform((v) => v || null),
  live_arrangement: z.enum(['live_in', 'live_out', 'either']),
})

export async function createContract(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('super_admin')
  const s = (k: string) => String(formData.get(k) ?? '')
  const parsed = contractSchema.safeParse({
    booking_id: s('booking_id'),
    rate: s('rate'),
    rate_period: s('rate_period'),
    starts_on: s('starts_on'),
    ends_on: s('ends_on'),
    amount_due: s('amount_due'),
    duties: s('duties'),
    live_arrangement: s('live_arrangement'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data
  if (d.starts_on && d.ends_on && d.ends_on < d.starts_on) return { error: 'The end date is before the start date' }

  const supabase = await createClient()
  const [agency, { data: booking }, { data: template }] = await Promise.all([
    getAgency(),
    supabase
      .from('booking_requests')
      .select('id, status, agency_id, client_id, staff_id, clients(name, phone, location_text), staff_profiles(full_name, staff_categories(name))')
      .eq('id', d.booking_id)
      .single(),
    supabase.from('contract_templates').select('id, version, body, defaults').eq('agency_id', session.agency_id).eq('is_active', true).order('version', { ascending: false }).limit(1).single(),
  ])
  if (!booking || booking.agency_id !== session.agency_id) return { error: 'Booking not found' }
  if (!booking.staff_id || !booking.staff_profiles) return { error: 'Assign a staff member first' }
  if (!template) return { error: 'No contract template found. Set one up under Settings.' }

  const defaults = template.defaults as unknown as TemplateDefaults
  const values = buildValues({
    agencyName: agency.name,
    clientName: booking.clients?.name ?? null,
    clientLocation: booking.clients?.location_text ?? null,
    clientPhone: booking.clients?.phone ?? null,
    staffName: booking.staff_profiles.full_name,
    staffRole: booking.staff_profiles.staff_categories?.name ?? 'staff member',
    startsOn: d.starts_on,
    live: d.live_arrangement,
    duties: d.duties,
    rate: d.rate,
    ratePeriod: d.rate_period,
    amountDue: d.amount_due,
    defaults,
  })

  const { error } = await supabase.from('contracts').insert({
    agency_id: session.agency_id,
    booking_request_id: booking.id,
    template_id: template.id,
    template_version: template.version,
    terms_json: { body: renderTemplate(template.body, values), values, defaults },
    rate: d.rate,
    rate_period: d.rate_period,
    starts_on: d.starts_on,
    ends_on: d.ends_on,
    amount_due: d.amount_due,
    duties: d.duties,
    live_arrangement: d.live_arrangement,
    status: 'sent',
  })
  if (error) return { error: error.code === '23505' ? 'This booking already has an open contract.' : error.message }

  await notifyClient(booking.client_id, {
    agencyId: booking.agency_id,
    type: 'contract_ready',
    subject: 'Your contract is ready to sign',
    message: `Your contract for ${booking.staff_profiles.full_name} is ready. Review and sign it online${d.amount_due ? `, then pay the ${formatKes(d.amount_due)} agency fee` : ''}.`,
    link: `/account/bookings/${booking.id}`,
    sms: true,
  })
  refresh(booking.id)
  return { message: 'Contract sent to the client.' }
}

export async function countersignContract(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('super_admin')
  const contractId = z.uuid().parse(formData.get('contract_id'))
  const name = z.string().trim().min(3, 'Type your full name to sign').max(120).safeParse(formData.get('signature'))
  if (!name.success) return { error: name.error.issues[0].message }

  const supabase = await createClient()
  const { data: contract } = await supabase.from('contracts').select('id, status, booking_request_id, admin_signed_at').eq('id', contractId).single()
  if (!contract) return { error: 'Contract not found' }
  if (contract.admin_signed_at) return { error: 'Already countersigned' }
  if (contract.status !== 'client_signed') return { error: 'The client needs to sign first' }

  const { error } = await supabase
    .from('contracts')
    .update({ admin_signature: name.data, admin_signed_at: new Date().toISOString(), admin_signed_by: session.id })
    .eq('id', contractId)
  if (error) return { error: error.message }
  await advanceContract(contractId)
  refresh(contract.booking_request_id)
  return { message: 'Countersigned. The signed PDF is ready.' }
}

export async function recordManualPayment(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('super_admin')
  const parsed = z
    .object({
      contract_id: z.uuid(),
      method: z.enum(['mpesa', 'cash', 'bank', 'card']),
      amount: money('amount').refine((v) => v !== null && v > 0, 'Enter the amount received'),
      reference: z.string().trim().max(60).transform((v) => v || null),
    })
    .safeParse({ contract_id: formData.get('contract_id'), method: formData.get('method'), amount: String(formData.get('amount') ?? ''), reference: String(formData.get('reference') ?? '') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data

  const supabase = await createClient()
  const { data: contract } = await supabase.from('contracts').select('id, booking_request_id, agency_id').eq('id', d.contract_id).single()
  if (!contract || contract.agency_id !== session.agency_id) return { error: 'Contract not found' }

  const { error } = await supabase.from('payments').insert({
    agency_id: session.agency_id,
    contract_id: d.contract_id,
    amount: d.amount!,
    method: d.method,
    mpesa_receipt: d.method === 'mpesa' ? d.reference?.toUpperCase() ?? null : null,
    card_ref: d.method === 'card' ? d.reference : null,
    raw_callback: d.method === 'bank' || d.method === 'cash' ? { reference: d.reference, recorded_by: session.id } : null,
    status: 'paid',
    paid_at: new Date().toISOString(),
  })
  if (error) return { error: error.code === '23505' ? 'That receipt number is already recorded.' : error.message }

  await afterPaid(d.contract_id, d.amount!, session.agency_id, `${d.method}${d.reference ? ` ${d.reference}` : ''}`)
  refresh(contract.booking_request_id)
  return { message: `${formatKes(d.amount)} recorded.` }
}

export async function cancelContract(formData: FormData) {
  await requireRole('super_admin')
  const contractId = z.uuid().parse(formData.get('contract_id'))
  const supabase = await createClient()
  const { data: c } = await supabase.from('contracts').select('booking_request_id, status').eq('id', contractId).single()
  if (!c || c.status === 'active' || c.status === 'ended') return
  await supabase.from('contracts').update({ status: 'cancelled' }).eq('id', contractId)
  await supabase.from('booking_requests').update({ status: 'matched' }).eq('id', c.booking_request_id)
  refresh(c.booking_request_id)
}

export async function endPlacement(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole('super_admin')
  const contractId = z.uuid().parse(formData.get('contract_id'))
  const reason = String(formData.get('reason') ?? '').trim().slice(0, 500)
  if (reason.length < 3) return { error: 'Give a short reason (e.g. contract finished, client ended, replaced)' }

  const supabase = await createClient()
  const { data: c } = await supabase.from('contracts').select('id, status, agency_id, booking_request_id, booking_requests(client_id, staff_id)').eq('id', contractId).single()
  if (!c || c.status !== 'active') return { error: 'Only active placements can be ended' }
  await supabase.from('contracts').update({ status: 'ended', ended_at: new Date().toISOString(), end_reason: reason }).eq('id', contractId)
  await supabase.from('booking_requests').update({ status: 'completed' }).eq('id', c.booking_request_id)
  if (c.booking_requests?.staff_id) await supabase.from('staff_profiles').update({ availability: 'available' }).eq('id', c.booking_requests.staff_id)
  if (c.booking_requests) {
    await notifyClient(c.booking_requests.client_id, {
      agencyId: c.agency_id,
      type: 'booking_update',
      message: 'Your placement has ended. We’d love your feedback: rate your staff member from your account.',
      link: `/account/bookings/${c.booking_request_id}`,
    })
  }
  refresh(c.booking_request_id)
  return { message: 'Placement ended.' }
}

export async function regeneratePdf(formData: FormData) {
  await requireRole('super_admin')
  const contractId = z.uuid().parse(formData.get('contract_id'))
  const path = await generateContractPdf(contractId)
  const { data } = await createAdminClient().from('contracts').update({ pdf_url: path }).eq('id', contractId).select('booking_request_id').single()
  if (data) refresh(data.booking_request_id)
}
