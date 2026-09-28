'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export async function updateLead(formData: FormData) {
  await requireRole('super_admin')
  const id = z.uuid().parse(formData.get('id'))
  const status = z.enum(['new', 'contacted', 'converted', 'closed']).parse(formData.get('status'))
  const supabase = await createClient()
  await supabase.from('leads').update({ status }).eq('id', id)
  revalidatePath('/admin', 'layout')
}
