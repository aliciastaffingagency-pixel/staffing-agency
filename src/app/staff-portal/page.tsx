import type { Metadata } from 'next'
import { Star } from 'lucide-react'
import { EmptyState, Panel, StatCard } from '@/components/portal/portal-shell'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Staff portal' }

// Read-only: staff see their own placements and ratings; only the agency edits profiles.
export default async function StaffHome() {
  const supabase = await createClient()
  const [{ data: me }, { data: placements }] = await Promise.all([
    supabase.from('staff_profiles').select('full_name, rating_avg, rating_count').maybeSingle(),
    supabase.from('booking_requests').select('id, status, start_date, location_text').order('start_date', { ascending: false }),
  ])

  return (
    <div className="grid gap-8">
      <h1 className="text-3xl font-extrabold tracking-tight text-navy-800">My placements</h1>
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Active placements" value={placements?.filter((p) => p.status === 'active').length ?? 0} />
        <StatCard
          label="My rating"
          value={me && me.rating_count > 0 ? `${Number(me.rating_avg).toFixed(1)} ★` : '—'}
          hint={me ? `${me.rating_count} review${me.rating_count === 1 ? '' : 's'}` : undefined}
        />
      </div>
      <Panel title="Schedule">
        {placements?.length ? (
          <ul className="grid gap-3">
            {placements.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-2xl bg-blush px-4 py-3 text-sm">
                <span className="text-navy-700">{p.location_text ?? 'Placement'}{p.start_date && ` · from ${p.start_date}`}</span>
                <span className="font-semibold capitalize text-brand-600">{p.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>
            <Star className="mx-auto mb-2 size-5 text-gold-500" />
            No placements yet — the agency will assign you here.
          </EmptyState>
        )}
      </Panel>
    </div>
  )
}
