import type { Metadata } from 'next'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { EmptyState, PageHeader, Panel, StatusPill } from '@/components/portal/portal-shell'
import { Button } from '@/components/ui/button'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { THREAD_KIND } from '@/lib/threads'
import { formatDate, formatDateTime } from '@/lib/utils'
import { moderateRating } from './actions'
import { ClaimReviewForm } from './claim-form'

export const metadata: Metadata = { title: 'Reviews & requests' }

const normal = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

export default async function ModerationPage() {
  const session = await requireRole('super_admin')
  const supabase = await createClient()
  const [{ data: pending }, { data: recent }, { data: claims }, { data: issues }, { data: staff }, { data: categories }] = await Promise.all([
    supabase
      .from('ratings')
      .select('id, stars, comment, created_at, clients(name, location_text), staff_profiles(id, full_name)')
      .eq('agency_id', session.agency_id)
      .is('moderated_at', null)
      .order('created_at'),
    supabase
      .from('ratings')
      .select('id, stars, comment, is_published, moderated_at, clients(name), staff_profiles(full_name)')
      .eq('agency_id', session.agency_id)
      .not('moderated_at', 'is', null)
      .order('moderated_at', { ascending: false })
      .limit(15),
    supabase
      .from('existing_staff_claims')
      .select('id, staff_full_name_freeform, staff_phone_freeform, notes, created_at, clients(name, phone, location_text)')
      .eq('agency_id', session.agency_id)
      .eq('status', 'pending')
      .order('created_at'),
    supabase
      .from('message_threads')
      .select('id, subject, kind, last_message_at, clients(name)')
      .eq('agency_id', session.agency_id)
      .eq('status', 'open')
      .in('kind', ['replacement', 'dispute', 'extension', 'end_request'])
      .order('last_message_at', { ascending: false }),
    supabase.from('staff_profiles').select('id, full_name, is_active, staff_categories(name)').eq('agency_id', session.agency_id).order('full_name'),
    supabase.from('staff_categories').select('id, name').eq('agency_id', session.agency_id).order('sort_order'),
  ])

  const staffOptions = (staff ?? []).map((s) => ({ id: s.id, label: `${s.full_name} · ${s.staff_categories?.name ?? ''}${s.is_active ? '' : ' (hidden)'}` }))

  return (
    <div className="grid gap-8">
      <PageHeader title="Reviews & requests" description="Approve reviews before they go public, confirm clients' existing staff, and handle replacement requests and disputes." />

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title={`Open requests & disputes (${issues?.length ?? 0})`}>
          {issues?.length ? (
            <ul className="grid gap-2">
              {issues.map((t) => (
                <li key={t.id}>
                  <Link href={`/admin/messages/${t.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-blush px-4 py-3 hover:bg-brand-50">
                    <span>
                      <span className="block font-semibold text-navy-800">{t.clients?.name ?? 'Client'}</span>
                      <span className="text-xs text-navy-400">{t.subject} · {formatDateTime(t.last_message_at)}</span>
                    </span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${t.kind === 'dispute' ? 'bg-red-50 text-red-600' : 'bg-gold-100 text-gold-700'}`}>{THREAD_KIND[t.kind].label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No open requests.</EmptyState>
          )}
        </Panel>

        <Panel title={`Staff claims to confirm (${claims?.length ?? 0})`}>
          {claims?.length ? (
            <ul className="grid gap-4">
              {claims.map((c) => {
                const guess = (staff ?? []).find((s) => normal(s.full_name) === normal(c.staff_full_name_freeform))
                return (
                  <li key={c.id} className="rounded-2xl border border-brand-100 p-4">
                    <p className="text-sm text-navy-700">
                      <strong>{c.clients?.name ?? 'A client'}</strong> ({c.clients?.location_text ?? 'no area'}) says <strong>{c.staff_full_name_freeform}</strong>
                      {c.staff_phone_freeform && ` (${c.staff_phone_freeform})`} works for them.
                    </p>
                    {c.notes && <p className="mt-1 text-sm text-navy-500">“{c.notes}”</p>}
                    <p className="mb-3 text-xs text-navy-400">{formatDate(c.created_at)}</p>
                    <ClaimReviewForm id={c.id} staff={staffOptions} categories={categories ?? []} suggested={guess?.id ?? null} />
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState>No claims waiting.</EmptyState>
          )}
        </Panel>
      </div>

      <Panel title={`Reviews waiting for approval (${pending?.length ?? 0})`}>
        {pending?.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {pending.map((r) => (
              <li key={r.id} className="rounded-2xl border border-brand-100 p-4">
                <div className="flex items-center justify-between gap-2">
                  <Stars n={r.stars} />
                  <span className="text-xs text-navy-400">{formatDate(r.created_at)}</span>
                </div>
                <p className="mt-2 text-sm text-navy-700">{r.comment ? `“${r.comment}”` : <em className="text-navy-400">No comment</em>}</p>
                <p className="mt-2 text-xs text-navy-500">
                  {r.clients?.name} ({r.clients?.location_text ?? '—'}) about{' '}
                  <Link href={`/admin/staff/${r.staff_profiles?.id}`} className="font-semibold text-brand-600 hover:underline">{r.staff_profiles?.full_name}</Link>
                </p>
                <form action={moderateRating} className="mt-3 flex flex-wrap gap-2">
                  <input type="hidden" name="id" value={r.id} />
                  <Button name="action" value="publish" size="sm">Publish</Button>
                  <Button name="action" value="hide" size="sm" variant="outline">Keep private</Button>
                  <Button name="action" value="delete" size="sm" variant="ghost" className="text-red-600 hover:bg-red-50">Delete</Button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>All reviews are moderated.</EmptyState>
        )}
      </Panel>

      {recent && recent.length > 0 && (
        <Panel title="Recently moderated">
          <ul className="grid gap-2 text-sm">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-blush px-4 py-2">
                <span className="flex items-center gap-2">
                  <Stars n={r.stars} /> {r.staff_profiles?.full_name} <span className="text-navy-400">by {r.clients?.name}</span>
                </span>
                <span className="flex items-center gap-2">
                  <StatusPill status={r.is_published ? 'published' : 'hidden'} />
                  <form action={moderateRating}>
                    <input type="hidden" name="id" value={r.id} />
                    <button name="action" value={r.is_published ? 'hide' : 'publish'} className="text-xs font-semibold text-brand-600 hover:underline">
                      {r.is_published ? 'Unpublish' : 'Publish'}
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}

function Stars({ n }: { n: number }) {
  return (
    <span className="flex" aria-label={`${n} stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`size-4 ${i <= n ? 'fill-gold-400 text-gold-500' : 'text-navy-200'}`} />
      ))}
    </span>
  )
}
