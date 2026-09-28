import type { Metadata } from 'next'
import { Star } from 'lucide-react'
import { EmptyState, Panel, StatCard, StatusPill } from '@/components/portal/portal-shell'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDate, LIVE_LABEL } from '@/lib/utils'

export const metadata: Metadata = { title: 'Staff portal' }

// Read-only: staff see their own placements and ratings; only the agency edits profiles.
export default async function StaffHome() {
  await requireRole('staff')
  const supabase = await createClient()
  const { data: me } = await supabase.from('staff_profiles').select('id, full_name, rating_avg, rating_count').maybeSingle()
  const [{ data: placements }, { data: reviews }] = await Promise.all([
    supabase.from('booking_requests').select('id, status, start_date, location_text, live_arrangement, clients(name)').order('start_date', { ascending: false }),
    me ? supabase.from('ratings').select('id, stars, comment, created_at').eq('staff_id', me.id).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
  ])

  return (
    <div className="grid gap-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-navy-800">
        Hello{me?.full_name ? `, ${me.full_name.split(' ')[0]}` : ''} <span className="font-script text-brand-500">karibu</span>
      </h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active placements" value={placements?.filter((p) => p.status === 'active').length ?? 0} />
        <StatCard label="All placements" value={placements?.length ?? 0} />
        <StatCard
          label="My rating"
          value={me && me.rating_count > 0 ? `${Number(me.rating_avg).toFixed(1)} ★` : '—'}
          hint={me ? `${me.rating_count} review${me.rating_count === 1 ? '' : 's'}` : undefined}
        />
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Panel title="My placements">
          {placements?.length ? (
            <ul className="grid gap-3">
              {placements.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-2xl bg-blush px-4 py-3 text-sm">
                  <span className="text-navy-700">
                    <span className="block font-semibold">{p.clients?.name ?? 'Client'}</span>
                    {p.location_text}
                    {p.live_arrangement && ` · ${LIVE_LABEL[p.live_arrangement]}`}
                    {p.start_date && ` · from ${formatDate(p.start_date)}`}
                  </span>
                  <StatusPill status={p.status} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No placements yet. The agency will assign you here.</EmptyState>
          )}
        </Panel>
        <Panel title="What clients say about me">
          {reviews?.length ? (
            <ul className="grid gap-3">
              {reviews.map((r) => (
                <li key={r.id} className="rounded-2xl bg-blush p-4 text-sm">
                  <span className="flex">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Star key={i} className={`size-4 ${i <= r.stars ? 'fill-gold-400 text-gold-500' : 'text-navy-200'}`} />
                    ))}
                  </span>
                  {r.comment && <p className="mt-2 text-navy-700">“{r.comment}”</p>}
                  <p className="mt-1 text-xs text-navy-400">{formatDate(r.created_at)}</p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>
              <Star className="mx-auto mb-2 size-5 text-gold-500" />
              No published reviews yet.
            </EmptyState>
          )}
        </Panel>
      </div>
    </div>
  )
}
