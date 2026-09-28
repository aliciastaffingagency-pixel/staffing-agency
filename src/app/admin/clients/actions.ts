'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { FormState } from '@/components/ui/form'
import { requireRole } from '@/lib/auth'
import { deleteClientAccount } from '@/lib/services/erasure'
import { createClient } from '@/lib/supabase/server'

// Handles deletion requests received by email/WhatsApp (the client can also delete their own account).
export async function deleteClient(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('super_admin')
  const id = z.uuid().safeParse(formData.get('id'))
  if (!id.success) return { error: 'Unknown client' }
  const supabase = await createClient()
  const { data: client } = await supabase.from('clients').select('id, user_id, agency_id').eq('id', id.data).maybeSingle()
  if (!client || client.agency_id !== session.agency_id) return { error: 'Client not found.' }
  if (String(formData.get('confirm') ?? '').trim().toUpperCase() !== 'DELETE') return { error: 'Type DELETE to confirm.' }
  if (!client.user_id) return { error: 'This account was already deleted; only records kept for legal reasons remain.' }
  const res = await deleteClientAccount(client.user_id, 'admin')
  if (res.error !== undefined) return { error: res.error }
  revalidatePath('/admin', 'layout')
  return { message: res.retainedContracts ? `Account deleted. ${res.retainedContracts} signed contract(s) kept, anonymised.` : 'Account and all data deleted.' }
}
