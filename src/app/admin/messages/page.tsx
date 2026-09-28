import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState, PageHeader, StatusPill } from '@/components/portal/portal-shell'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { THREAD_KIND } from '@/lib/threads'
import { cn, formatDateTime } from '@/lib/utils'

export const metadata: Metadata = { title: 'Messages' }

export default async function AdminMessagesPage({ searchParams }: PageProps<'/admin/messages'>) {
  const session = await requireRole('super_admin')
  const sp = await searchParams
  const show = sp.show === 'resolved' ? 'resolved' : sp.show === 'all' ? 'all' : 'open'

  const supabase = await createClient()
  let query = supabase
    .from('message_threads')
    .select('id, subject, kind, status, last_message_at, admin_last_read_at, clients(name, phone), staff_profiles(full_name)')
    .eq('agency_id', session.agency_id)
    .order('last_message_at', { ascending: false })
    .limit(200)
  if (show !== 'all') query = query.eq('status', show)
  const { data: threads } = await query

  return (
    <div className="grid gap-8">
      <PageHeader title="Messages" description="Every conversation with clients, including replacement requests and disputes." />
      <nav className="flex gap-2" aria-label="Filter">
        {(['open', 'resolved', 'all'] as const).map((v) => (
          <Link key={v} href={`/admin/messages?show=${v}`} className={cn('rounded-full px-4 py-2 text-sm font-semibold capitalize', show === v ? 'bg-navy-800 text-white' : 'bg-white text-navy-600 hover:bg-brand-50')}>
            {v}
          </Link>
        ))}
      </nav>
      {threads?.length ? (
        <ul className="grid gap-2">
          {threads.map((t) => {
            const unread = t.last_message_at > t.admin_last_read_at
            return (
              <li key={t.id}>
                <Link href={`/admin/messages/${t.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-brand-100 bg-white px-5 py-4 hover:border-brand-300">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-semibold text-navy-800">
                      {unread && <span className="size-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
                      {t.clients?.name ?? 'Client'}
                      <span className="font-normal text-navy-500">· {t.subject}</span>
                    </span>
                    <span className="text-xs text-navy-400">
                      {THREAD_KIND[t.kind].label}
                      {t.staff_profiles?.full_name && ` · about ${t.staff_profiles.full_name}`} · {formatDateTime(t.last_message_at)}
                    </span>
                  </span>
                  <StatusPill status={t.status} />
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState>No {show === 'all' ? '' : show} conversations.</EmptyState>
      )}
    </div>
  )
}
