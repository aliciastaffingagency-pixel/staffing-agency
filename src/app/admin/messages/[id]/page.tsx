import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Phone } from 'lucide-react'
import { ChatThread } from '@/components/chat/chat-thread'
import { StatusPill } from '@/components/portal/portal-shell'
import { Button, ButtonLink } from '@/components/ui/button'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { THREAD_KIND } from '@/lib/threads'
import { resolveThread } from '../../moderation/actions'

export const metadata: Metadata = { title: 'Conversation' }

export default async function AdminThreadPage({ params }: PageProps<'/admin/messages/[id]'>) {
  const session = await requireRole('super_admin')
  const { id } = await params
  const supabase = await createClient()
  const [{ data: thread }, { data: messages }] = await Promise.all([
    supabase
      .from('message_threads')
      .select('id, subject, kind, status, booking_request_id, claim_id, clients(name, phone), staff_profiles(id, full_name)')
      .eq('id', id)
      .eq('agency_id', session.agency_id)
      .maybeSingle(),
    supabase.from('messages').select('id, body, sender_role, created_at').eq('thread_id', id).order('created_at'),
  ])
  if (!thread) notFound()

  return (
    <div className="mx-auto grid max-w-4xl gap-4">
      <Link href="/admin/messages" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-brand-600">
        <ArrowLeft className="size-4" /> All messages
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-navy-800">
            {thread.clients?.name ?? 'Client'} <span className="font-normal text-navy-500">· {thread.subject}</span>
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-navy-500">
            <StatusPill status={thread.status} />
            {THREAD_KIND[thread.kind].label}
            {thread.staff_profiles && (
              <>
                {' · about '}
                <Link href={`/admin/staff/${thread.staff_profiles.id}`} className="font-semibold text-brand-600 hover:underline">{thread.staff_profiles.full_name}</Link>
              </>
            )}
            {thread.booking_request_id && (
              <Link href={`/admin/bookings/${thread.booking_request_id}`} className="font-semibold text-brand-600 hover:underline">· booking</Link>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {thread.clients?.phone && (
            <ButtonLink href={`tel:${thread.clients.phone}`} variant="outline" size="sm"><Phone className="size-4" /> Call</ButtonLink>
          )}
          <form action={resolveThread}>
            <input type="hidden" name="id" value={thread.id} />
            {thread.status === 'open' ? (
              <Button size="sm" variant="navy">Mark resolved</Button>
            ) : (
              <Button size="sm" variant="outline" name="reopen" value="1">Reopen</Button>
            )}
          </form>
        </div>
      </div>
      <ChatThread threadId={thread.id} me="super_admin" initial={messages ?? []} otherName={thread.clients?.name ?? 'Client'} />
    </div>
  )
}
