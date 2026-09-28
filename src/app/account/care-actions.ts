'use server'

// Phase 4 client actions: conversations & requests, ratings, existing-staff claims.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { FormState } from '@/components/ui/form'
import { requireRole } from '@/lib/auth'
import { notify } from '@/lib/notify'
import { rateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { KIND_NOTIFICATION, THREAD_KIND, THREAD_KINDS } from '@/lib/threads'
import { normalizeKePhone } from '@/lib/utils'

const optionalUuid = z.union([z.uuid(), z.literal('')]).transform((v) => v || null)

export async function startThread(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('client')
  const parsed = z
    .object({
      kind: z.enum(THREAD_KINDS),
      subject: z.string().trim().max(120).transform((v) => v || null),
      body: z.string().trim().min(5, 'Write a short message').max(5000),
      booking_id: optionalUuid,
      claim_id: optionalUuid,
    })
    .safeParse({
      kind: formData.get('kind') || 'general',
      subject: String(formData.get('subject') ?? ''),
      body: String(formData.get('body') ?? ''),
      booking_id: String(formData.get('booking_id') ?? ''),
      claim_id: String(formData.get('claim_id') ?? ''),
    })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!(await rateLimit('thread', 10, 3600, session.id))) return { error: 'You have opened many conversations recently. Please continue in an existing one.' }
  const d = parsed.data

  const supabase = await createClient()
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
    .insert({
      agency_id: client.agency_id,
      client_id: client.id,
      kind: d.kind,
      subject: d.subject ?? THREAD_KIND[d.kind].label,
      booking_request_id: d.booking_id,
      claim_id: d.claim_id,
      staff_id: staffId,
    })
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
  redirect(`/account/messages/${thread.id}`)
}

export async function submitRating(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('client')
  const parsed = z
    .object({
      staff_id: z.uuid(),
      contract_id: optionalUuid,
      claim_id: optionalUuid,
      stars: z.coerce.number().int().min(1, 'Choose 1 to 5 stars').max(5, 'Choose 1 to 5 stars'),
      comment: z.string().trim().max(2000).transform((v) => v || null),
    })
    .safeParse({
      staff_id: formData.get('staff_id'),
      contract_id: String(formData.get('contract_id') ?? ''),
      claim_id: String(formData.get('claim_id') ?? ''),
      stars: formData.get('stars') ?? 0,
      comment: String(formData.get('comment') ?? ''),
    })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
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
  revalidatePath('/account', 'layout')
  return { message: 'Thank you! Your review will appear once the agency has checked it.' }
}

export async function fileClaim(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('client')
  const parsed = z
    .object({
      staff_full_name_freeform: z.string().trim().min(2, 'Enter their full name').max(120),
      staff_phone_freeform: z.string().transform((v, ctx) => {
        if (!v.trim()) return null
        const p = normalizeKePhone(v)
        if (!p) ctx.addIssue({ code: 'custom', message: 'Enter a valid Kenyan phone number (or leave it blank)' })
        return p
      }),
      notes: z.string().trim().max(2000).transform((v) => v || null),
    })
    .safeParse({
      staff_full_name_freeform: String(formData.get('staff_full_name_freeform') ?? ''),
      staff_phone_freeform: String(formData.get('staff_phone_freeform') ?? ''),
      notes: String(formData.get('notes') ?? ''),
    })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!(await rateLimit('claim', 10, 86400, session.id))) return { error: 'Too many requests today. Please contact us.' }

  const supabase = await createClient()
  const { data: client } = await supabase.from('clients').select('id, agency_id').eq('user_id', session.id).single()
  if (!client) return { error: 'Client profile not found' }
  const { error } = await supabase.from('existing_staff_claims').insert({ ...parsed.data, agency_id: client.agency_id, client_id: client.id, status: 'pending' })
  if (error) return { error: error.message }

  await notify({
    agencyId: client.agency_id,
    role: 'super_admin',
    type: 'claim_update',
    message: `${session.full_name ?? 'A client'} says ${parsed.data.staff_full_name_freeform} already works for them. Please confirm.`,
    link: '/admin/moderation',
  })
  revalidatePath('/account/staff')
  return { message: 'Sent! We’ll check our records and confirm.' }
}
