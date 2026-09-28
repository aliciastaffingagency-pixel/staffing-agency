'use server'

import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

// RLS limits this to notifications the signed-in user can see.
export async function markNotificationsRead(ids: string[]) {
  if (!(await getSession())) return
  const parsed = z.array(z.uuid()).max(50).safeParse(ids)
  if (!parsed.success || !parsed.data.length) return
  const supabase = await createClient()
  await supabase.from('notifications').update({ read: true }).in('id', parsed.data)
}
