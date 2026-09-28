'use server'

import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { sendMessageOp } from '@/lib/services/client-ops'
import { createClient } from '@/lib/supabase/server'

export async function sendMessage(threadId: string, body: string): Promise<{ error?: string; id?: string; created_at?: string }> {
  const session = await getSession()
  if (!session) return { error: 'Not allowed' }
  return sendMessageOp({ supabase: await createClient(), session }, threadId, body)
}

export async function markThreadRead(threadId: string) {
  const session = await getSession()
  if (!session || !z.uuid().safeParse(threadId).success) return
  const supabase = await createClient()
  const now = new Date().toISOString()
  if (session.role === 'client') await supabase.from('message_threads').update({ client_last_read_at: now }).eq('id', threadId)
  if (session.role === 'super_admin') await supabase.from('message_threads').update({ admin_last_read_at: now }).eq('id', threadId)
}
