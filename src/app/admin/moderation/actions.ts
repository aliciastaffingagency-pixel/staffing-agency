'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { FormState } from '@/components/ui/form'
import { requireRole } from '@/lib/auth'
import { notifyClient } from '@/lib/notify'
import { createClient } from '@/lib/supabase/server'

const refresh = () => {
  revalidatePath('/admin', 'layout')
  revalidatePath('/', 'layout')
}

// Publish / hide / delete a client review. Staff rating averages follow via trigger.
export async function moderateRating(formData: FormData) {
  const session = await requireRole('super_admin')
  const id = z.uuid().parse(formData.get('id'))
  const action = z.enum(['publish', 'hide', 'delete']).parse(formData.get('action'))
  const note = String(formData.get('admin_note') ?? '').trim().slice(0, 500) || null
  const supabase = await createClient()
  if (action === 'delete') await supabase.from('ratings').delete().eq('id', id)
  else
    await supabase
      .from('ratings')
      .update({ is_published: action === 'publish', moderated_by: session.id, moderated_at: new Date().toISOString(), admin_note: note })
      .eq('id', id)
  refresh()
}

export async function resolveThread(formData: FormData) {
  await requireRole('super_admin')
  const id = z.uuid().parse(formData.get('id'))
  const reopen = formData.get('reopen') === '1'
  const supabase = await createClient()
  await supabase
    .from('message_threads')
    .update({ status: reopen ? 'open' : 'resolved', resolved_at: reopen ? null : new Date().toISOString() })
    .eq('id', id)
  refresh()
}

// Confirm a client's "they already work for me" claim by linking a staff profile
// (existing, or a new hidden one created from the claim), or reject it.
export async function reviewClaim(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('super_admin')
  const parsed = z
    .object({
      id: z.uuid(),
      decision: z.enum(['confirm', 'reject']),
      staff_id: z.union([z.uuid(), z.literal(''), z.literal('new')]),
      category_id: z.union([z.uuid(), z.literal('')]),
    })
    .safeParse({
      id: formData.get('id'),
      decision: formData.get('decision'),
      staff_id: String(formData.get('staff_id') ?? ''),
      category_id: String(formData.get('category_id') ?? ''),
    })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const d = parsed.data

  const supabase = await createClient()
  const { data: claim } = await supabase.from('existing_staff_claims').select('*').eq('id', d.id).eq('agency_id', session.agency_id).single()
  if (!claim) return { error: 'Claim not found' }

  let staffId: string | null = null
  if (d.decision === 'confirm') {
    if (d.staff_id === 'new') {
      if (!d.category_id) return { error: 'Choose a category for the new staff profile' }
      const { data: created, error } = await supabase
        .from('staff_profiles')
        .insert({ agency_id: session.agency_id, category_id: d.category_id, full_name: claim.staff_full_name_freeform, is_active: false, availability: 'placed' })
        .select('id')
        .single()
      if (error) return { error: error.message }
      staffId = created.id
    } else if (d.staff_id) {
      staffId = d.staff_id
    } else {
      return { error: 'Choose which staff member this is' }
    }
  }

  const { error } = await supabase
    .from('existing_staff_claims')
    .update({ status: d.decision === 'confirm' ? 'confirmed' : 'rejected', agency_confirmed_staff_id: staffId, reviewed_by: session.id, reviewed_at: new Date().toISOString() })
    .eq('id', d.id)
  if (error) return { error: error.message }

  await notifyClient(claim.client_id, {
    agencyId: claim.agency_id,
    type: 'claim_update',
    message:
      d.decision === 'confirm'
        ? `We've confirmed ${claim.staff_full_name_freeform} works for you through us. You can now rate them and request replacements online.`
        : `We couldn't match ${claim.staff_full_name_freeform} to our records. Message us if you think this is a mistake.`,
    link: '/account/staff',
  })
  refresh()
  return { message: d.decision === 'confirm' ? 'Confirmed. The client can now rate and request replacements.' : 'Claim rejected.' }
}
