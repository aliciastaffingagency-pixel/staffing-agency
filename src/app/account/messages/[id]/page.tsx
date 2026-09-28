import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { ChatThread } from '@/components/chat/chat-thread'
import { StatusPill } from '@/components/portal/portal-shell'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { THREAD_KIND } from '@/lib/threads'

export const metadata: Metadata = { title: 'Conversation' }

export default async function ClientThreadPage({ params }: PageProps<'/account/messages/[id]'>) {
  await requireRole('client')
  const { id } = await params
  const supabase = await createClient()
  const [{ data: thread }, { data: messages }] = await Promise.all([
    supabase.from('message_threads').select('id, subject, kind, status, booking_request_id').eq('id', id).maybeSingle(),
    supabase.from('messages').select('id, body, sender_role, created_at').eq('thread_id', id).order('created_at'),
  ])
  if (!thread) notFound()

  return (
    <div className="mx-auto grid max-w-3xl gap-4">
      <Link href="/account/messages" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-brand-600">
        <ArrowLeft className="size-4" /> All messages
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-800">{thread.subject ?? THREAD_KIND[thread.kind].label}</h1>
          <p className="text-sm text-navy-500">
            {THREAD_KIND[thread.kind].label}
            {thread.booking_request_id && (
              <>
                {' · '}
                <Link href={`/account/bookings/${thread.booking_request_id}`} className="font-semibold text-brand-600 hover:underline">View booking</Link>
              </>
            )}
          </p>
        </div>
        <StatusPill status={thread.status} />
      </div>
      <ChatThread threadId={thread.id} me="client" initial={messages ?? []} otherName="Alicia Staffing Agency" />
    </div>
  )
}
