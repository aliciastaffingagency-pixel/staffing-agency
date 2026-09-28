import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState, PageHeader, Panel, StatusPill } from '@/components/portal/portal-shell'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { THREAD_KIND } from '@/lib/threads'
import { formatDateTime } from '@/lib/utils'
import { RequestForm } from '../care-forms'

export const metadata: Metadata = { title: 'Messages' }

export default async function ClientMessagesPage() {
  await requireRole('client')
  const supabase = await createClient()
  const { data: threads } = await supabase
    .from('message_threads')
    .select('id, subject, kind, status, last_message_at, client_last_read_at')
    .order('last_message_at', { ascending: false })

  return (
    <div className="grid gap-8">
      <PageHeader title="Messages" description="Talk to the agency directly: questions, replacements, issues. Everything stays in one place." />
      <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Conversations">
          {threads?.length ? (
            <ul className="grid gap-2">
              {threads.map((t) => {
                const unread = t.last_message_at > t.client_last_read_at
                return (
                  <li key={t.id}>
                    <Link href={`/account/messages/${t.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-blush px-4 py-3 hover:bg-brand-50">
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-semibold text-navy-800">
                          {unread && <span className="size-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
                          <span className="truncate">{t.subject ?? THREAD_KIND[t.kind].label}</span>
                        </span>
                        <span className="text-xs text-navy-400">{THREAD_KIND[t.kind].label} · {formatDateTime(t.last_message_at)}</span>
                      </span>
                      <StatusPill status={t.status} />
                    </Link>
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState>No conversations yet.</EmptyState>
          )}
        </Panel>
        <Panel title="Ask us anything">
          <RequestForm kinds={['general']} withSubject submitLabel="Send message" />
        </Panel>
      </div>
    </div>
  )
}
