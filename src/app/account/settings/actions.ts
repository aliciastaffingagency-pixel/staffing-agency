'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { FormState } from '@/components/ui/form'
import { requireRole } from '@/lib/auth'
import { deleteClientAccount } from '@/lib/services/erasure'
import { createClient } from '@/lib/supabase/server'
import { normalizeKePhone } from '@/lib/utils'

export async function updateMyDetails(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('client')
  const name = z.string().trim().min(2, 'Enter your full name').max(120).safeParse(formData.get('full_name'))
  if (!name.success) return { error: name.error.issues[0].message }
  const phone = normalizeKePhone(String(formData.get('phone') ?? ''))
  if (!phone) return { error: 'Enter a valid Kenyan phone number, e.g. 0712 345 678' }

  const supabase = await createClient()
  const [{ error: e1 }, { error: e2 }] = await Promise.all([
    supabase.from('profiles').update({ full_name: name.data, phone }).eq('id', session.id),
    supabase.from('clients').update({ name: name.data, phone }).eq('user_id', session.id),
  ])
  if (e1 || e2) return { error: (e1 ?? e2)!.message }
  revalidatePath('/account', 'layout')
  return { message: 'Your details are saved.' }
}

export async function deleteMyAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('client')
  if (String(formData.get('confirm') ?? '').trim().toUpperCase() !== 'DELETE') return { error: 'Type DELETE to confirm.' }
  const res = await deleteClientAccount(session.id, 'self')
  if (res.error !== undefined) return { error: res.error }
  // The login no longer exists; clear the session cookies on this device.
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/account-deleted')
}
