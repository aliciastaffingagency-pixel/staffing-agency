'use server'

import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { notify, notifyClient } from '@/lib/notify'
import { rateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'

export async function sendMessage(threadId: string, body: string): Promise<{ error?: string; id?: string; created_at?: string }> {
  const session = await getSession()
  if (!session || session.role === 'staff') return { error: 'Not allowed' }
  const parsed = z.object({ threadId: z.uuid(), body: z.string().trim().min(1, 'Type a message').max(5000) }).safeParse({ threadId, body })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!(await rateLimit('message', 30, 60, session.id))) return { error: 'You are sending messages too quickly.' }

  const supabase = await createClient()
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

export async function markThreadRead(threadId: string) {
  const session = await getSession()
  if (!session || !z.uuid().safeParse(threadId).success) return
  const supabase = await createClient()
  const now = new Date().toISOString()
  if (session.role === 'client') await supabase.from('message_threads').update({ client_last_read_at: now }).eq('id', threadId)
  if (session.role === 'super_admin') await supabase.from('message_threads').update({ admin_last_read_at: now }).eq('id', threadId)
}
