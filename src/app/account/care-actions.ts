'use server'

// Client actions: conversations & requests, ratings, existing-staff claims.
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { FormState } from '@/components/ui/form'
import { requireRole } from '@/lib/auth'
import { notify } from '@/lib/notify'
import { rateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { startThreadOp, submitRatingOp } from '@/lib/services/client-ops'
import { normalizeKePhone } from '@/lib/utils'

export async function startThread(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('client')
  const res = await startThreadOp({ supabase: await createClient(), session }, Object.fromEntries(formData))
  if (res.error !== undefined) return { error: res.error }
  redirect(`/account/messages/${res.threadId}`)
}

export async function submitRating(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('client')
  const res = await submitRatingOp({ supabase: await createClient(), session }, Object.fromEntries(formData))
  if (res.error !== undefined) return { error: res.error }
  revalidatePath('/account', 'layout')
  return { message: res.message }
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
