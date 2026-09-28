import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { advanceContract } from '@/lib/contracts'
import { notify, notifyClient } from '@/lib/notify'
import { startMpesaPayment } from '@/lib/payments'
import { rateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Database } from '@/lib/supabase/database.types'
import { KIND_NOTIFICATION, THREAD_KIND, THREAD_KINDS } from '@/lib/threads'
import { formatKes, normalizeKePhone } from '@/lib/utils'

// Shared by the web server actions (cookie session) and the mobile API (bearer token):
// `supabase` always acts AS the signed-in user, so RLS still applies.
export type OpsSession = { id: string; agency_id: string; role: Database['public']['Enums']['user_role']; full_name: string | null; email: string | null; phone: string | null }
export type Ctx = { supabase: SupabaseClient<Database>; session: OpsSession }
export type Result<T = object> = ({ error: string } & Partial<Record<keyof T, never>>) | ({ error?: undefined } & T)

type Input = Record<string, unknown>
const str = (v: unknown) => (v == null ? '' : String(v))
const optionalUuid = z.union([z.uuid(), z.literal('')]).transform((v) => v || null)

// ---------------------------------------------------------------------------
// Booking request
// ---------------------------------------------------------------------------
const bookingSchema = z.object({
  staff_id: optionalUuid,
  category_id: z.uuid('Choose the kind of staff you need'),
  start_date: z
    .union([z.iso.date(), z.literal('')])
    .transform((v) => v || null)
    .refine((v) => v === null || v >= new Date(Date.now() - 86_400_000).toISOString().slice(0, 10), 'The start date is in the past'),
  live_arrangement: z.enum(['live_in', 'live_out', 'either']),
  location_text: z.string().trim().min(2, 'Tell us where the job is').max(120),
  budget: z
    .string()
    .transform((v) => (v.trim() === '' ? null : Number(v.replace(/[,\s]/g, ''))))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 10_000_000), 'Enter your budget as a number'),
  notes: z.string().trim().max(3000).transform((v) => v || null),
})

export async function createBookingOp({ supabase, session }: Ctx, input: Input): Promise<Result<{ bookingId: string }>> {
  if (session.role !== 'client') return { error: 'Only client accounts can request staff.' }
  const parsed = bookingSchema.safeParse({
    staff_id: str(input.staff_id),
    category_id: str(input.category_id),
    start_date: str(input.start_date),
    live_arrangement: str(input.live_arrangement) || 'either',
    location_text: str(input.location_text),
    budget: str(input.budget),
    notes: str(input.notes),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!(await rateLimit('booking', 10, 3600, session.id))) return { error: 'You have sent many requests recently. Please try again later.' }

  const { data: client } = await supabase.from('clients').select('id, agency_id, name, location_text').eq('user_id', session.id).single()
  if (!client) return { error: 'We could not find your client profile. Please contact us.' }

  let staffName: string | null = null
  if (parsed.data.staff_id) {
    const { data: staff } = await supabase.from('staff_catalog').select('id, full_name, category_id').eq('id', parsed.data.staff_id).maybeSingle()
    if (!staff) return { error: 'That staff member is no longer listed. Choose someone else or request by role.' }
    parsed.data.category_id = staff.category_id!
    staffName = staff.full_name
  }

  const { data: booking, error } = await supabase
    .from('booking_requests')
    .insert({ ...parsed.data, agency_id: client.agency_id, client_id: client.id, status: 'pending' })
    .select('id, staff_categories(name)')
    .single()
  if (error) return { error: error.message }

  // Remember the area for next time.
  if (!client.location_text) await supabase.from('clients').update({ location_text: parsed.data.location_text }).eq('id', client.id)

  const role = booking.staff_categories?.name ?? 'staff'
  await notify({
    agencyId: client.agency_id,
    role: 'super_admin',
    type: 'new_request',
    subject: `New booking request: ${role}`,
    message: `${client.name ?? 'A client'} requested ${staffName ? `${staffName} (${role})` : `a ${role}`} in ${parsed.data.location_text}${parsed.data.budget ? `, budget ${formatKes(parsed.data.budget)}` : ''}.`,
    link: `/admin/bookings/${booking.id}`,
    sms: true,
  })
  return { bookingId: booking.id }
}

// ---------------------------------------------------------------------------
// Contracts: sign + pay (M-Pesa)
// ---------------------------------------------------------------------------
// Loads the contract through the CLIENT's own RLS view: if they can't read it, they can't act on it.
async function myContract(supabase: Ctx['supabase'], contractId: string) {
  const { data } = await supabase
    .from('contracts')
    .select('id, agency_id, status, client_signed_at, booking_request_id, booking_requests(client_id, clients(name))')
    .eq('id', contractId)
    .maybeSingle()
  return data
}

export async function signContractOp({ supabase, session }: Ctx, input: Input, ip: string): Promise<Result<{ bookingId: string }>> {
  if (session.role !== 'client') return { error: 'Not allowed' }
  const parsed = z
    .object({
      contract_id: z.uuid(),
      signature: z.string().trim().min(3, 'Type your full name to sign').max(120),
      agree: z.literal(true, 'Tick the box to confirm you agree to the terms'),
    })
    .safeParse({ contract_id: str(input.contract_id), signature: str(input.signature), agree: input.agree === true || input.agree === 'on' })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const contract = await myContract(supabase, parsed.data.contract_id)
  if (!contract) return { error: 'Contract not found' }
  if (contract.status !== 'sent' || contract.client_signed_at) return { error: 'This contract is not open for signing.' }

  const { error } = await createAdminClient()
    .from('contracts')
    .update({ client_signature: parsed.data.signature, client_signed_at: new Date().toISOString(), client_ip: ip })
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
  return { bookingId: contract.booking_request_id }
}

export async function payMpesaOp({ supabase, session }: Ctx, input: Input): Promise<Result<{ bookingId: string; message: string }>> {
  if (session.role !== 'client') return { error: 'Not allowed' }
  const contractId = z.uuid().safeParse(str(input.contract_id))
  const phone = normalizeKePhone(str(input.phone))
  if (!contractId.success) return { error: 'Contract not found' }
  if (!phone) return { error: 'Enter the M-Pesa phone number, e.g. 0712 345 678' }
  if (!(await rateLimit('mpesa-stk', 6, 600, session.id))) return { error: 'Too many payment attempts. Please wait a few minutes.' }

  const contract = await myContract(supabase, contractId.data)
  if (!contract) return { error: 'Contract not found' }
  try {
    const res = await startMpesaPayment(contract.id, phone)
    return { bookingId: contract.booking_request_id, message: `${res.message}. Enter your M-Pesa PIN on ${phone} to pay.` }
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Could not start the M-Pesa payment' }
  }
}

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------
export async function startThreadOp({ supabase, session }: Ctx, input: Input): Promise<Result<{ threadId: string }>> {
  if (session.role !== 'client') return { error: 'Not allowed' }
  const parsed = z
    .object({
      kind: z.enum(THREAD_KINDS),
      subject: z.string().trim().max(120).transform((v) => v || null),
      body: z.string().trim().min(5, 'Write a short message').max(5000),
      booking_id: optionalUuid,
      claim_id: optionalUuid,
    })
    .safeParse({
      kind: str(input.kind) || 'general',
      subject: str(input.subject),
      body: str(input.body),
      booking_id: str(input.booking_id),
      claim_id: str(input.claim_id),
    })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!(await rateLimit('thread', 10, 3600, session.id))) return { error: 'You have opened many conversations recently. Please continue in an existing one.' }
  const d = parsed.data

  const { data: client } = await supabase.from('clients').select('id, agency_id').eq('user_id', session.id).single()
  if (!client) return { error: 'Client profile not found' }

  // The staff member the request is about (from the booking or a confirmed claim).
  let staffId: string | null = null
  if (d.booking_id) {
    const { data: b } = await supabase.from('booking_requests').select('staff_id').eq('id', d.booking_id).maybeSingle()
    if (!b) return { error: 'Booking not found' }
    staffId = b.staff_id
  }
  if (d.claim_id) {
    const { data: c } = await supabase.from('existing_staff_claims').select('agency_confirmed_staff_id, status').eq('id', d.claim_id).maybeSingle()
    if (!c || c.status !== 'confirmed') return { error: 'That staff member hasn’t been confirmed yet' }
    staffId = c.agency_confirmed_staff_id
  }

  const { data: thread, error } = await supabase
    .from('message_threads')
    .insert({ agency_id: client.agency_id, client_id: client.id, kind: d.kind, subject: d.subject ?? THREAD_KIND[d.kind].label, booking_request_id: d.booking_id, claim_id: d.claim_id, staff_id: staffId })
    .select('id')
    .single()
  if (error) return { error: error.message }
  const { error: msgErr } = await supabase.from('messages').insert({ thread_id: thread.id, sender_id: session.id, sender_role: 'client', body: d.body })
  if (msgErr) return { error: msgErr.message }

  await notify({
    agencyId: client.agency_id,
    role: 'super_admin',
    type: KIND_NOTIFICATION[d.kind],
    subject: `${THREAD_KIND[d.kind].label}: ${session.full_name ?? 'client'}`,
    message: `${session.full_name ?? 'A client'}, ${THREAD_KIND[d.kind].label.toLowerCase()}: ${d.body.slice(0, 100)}`,
    link: `/admin/messages/${thread.id}`,
    sms: d.kind === 'dispute' || d.kind === 'replacement',
  })
  return { threadId: thread.id }
}

export async function sendMessageOp({ supabase, session }: Ctx, threadId: string, body: string): Promise<Result<{ id: string; created_at: string }>> {
  if (session.role === 'staff') return { error: 'Not allowed' }
  const parsed = z.object({ threadId: z.uuid(), body: z.string().trim().min(1, 'Type a message').max(5000) }).safeParse({ threadId, body })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!(await rateLimit('message', 30, 60, session.id))) return { error: 'You are sending messages too quickly.' }

  // RLS: only the thread's client or the agency admin can post, as their real role.
  const { data: msg, error } = await supabase
    .from('messages')
    .insert({ thread_id: parsed.data.threadId, sender_id: session.id, sender_role: session.role, body: parsed.data.body })
    .select('id, created_at')
    .single()
  if (error) return { error: 'Could not send. Please try again.' }

  const { data: thread } = await supabase.from('message_threads').select('id, agency_id, client_id, subject').eq('id', parsed.data.threadId).single()
  if (thread) {
    const preview = parsed.data.body.length > 90 ? `${parsed.data.body.slice(0, 90)}…` : parsed.data.body
    if (session.role === 'client') {
      await notify({ agencyId: thread.agency_id, role: 'super_admin', type: 'new_message', subject: `New message: ${thread.subject ?? 'Client'}`, message: `${session.full_name ?? 'A client'}: ${preview}`, link: `/admin/messages/${thread.id}` })
    } else {
      await notifyClient(thread.client_id, { agencyId: thread.agency_id, type: 'new_message', subject: 'New message from the agency', message: `Alicia Staffing Agency: ${preview}`, link: `/account/messages/${thread.id}` })
    }
  }
  return { id: msg.id, created_at: msg.created_at }
}

// ---------------------------------------------------------------------------
// Ratings
// ---------------------------------------------------------------------------
export async function submitRatingOp({ supabase, session }: Ctx, input: Input): Promise<Result<{ message: string }>> {
  if (session.role !== 'client') return { error: 'Not allowed' }
  const parsed = z
    .object({
      staff_id: z.uuid(),
      contract_id: optionalUuid,
      claim_id: optionalUuid,
      stars: z.coerce.number().int().min(1, 'Choose 1 to 5 stars').max(5, 'Choose 1 to 5 stars'),
      comment: z.string().trim().max(2000).transform((v) => v || null),
    })
    .safeParse({ staff_id: str(input.staff_id), contract_id: str(input.contract_id), claim_id: str(input.claim_id), stars: input.stars ?? 0, comment: str(input.comment) })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const { data: client } = await supabase.from('clients').select('id, agency_id').eq('user_id', session.id).single()
  if (!client) return { error: 'Client profile not found' }
  // RLS only accepts ratings for staff this client actually had (active/ended contract or confirmed claim).
  const { error } = await supabase.from('ratings').insert({ ...parsed.data, agency_id: client.agency_id, client_id: client.id })
  if (error) return { error: error.code === '23505' ? 'You have already rated this placement. Thank you!' : 'You can rate staff once they have worked for you.' }

  await notify({
    agencyId: client.agency_id,
    role: 'super_admin',
    type: 'rating_submitted',
    message: `New ${parsed.data.stars}★ review from ${session.full_name ?? 'a client'} waiting for moderation.`,
    link: '/admin/moderation',
  })
  return { message: 'Thank you! Your review will appear once the agency has checked it.' }
}
