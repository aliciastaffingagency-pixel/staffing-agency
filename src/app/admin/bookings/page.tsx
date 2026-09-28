import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState, PageHeader, StatusPill } from '@/components/portal/portal-shell'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { cn, formatDate, formatKes } from '@/lib/utils'

export const metadata: Metadata = { title: 'Bookings' }

const TABS = [
  { value: 'open', label: 'Needs action', statuses: ['pending', 'matched'] },
  { value: 'contracted', label: 'Contracted', statuses: ['contracted'] },
  { value: 'active', label: 'Active', statuses: ['active'] },
  { value: 'closed', label: 'Closed', statuses: ['completed', 'cancelled'] },
  { value: 'all', label: 'All', statuses: [] },
] as const

export default async function AdminBookingsPage({ searchParams }: PageProps<'/admin/bookings'>) {
  const session = await requireRole('super_admin')
  const sp = await searchParams
  const tab = TABS.find((t) => t.value === sp.tab) ?? TABS[0]

  const supabase = await createClient()
  let query = supabase
    .from('booking_requests')
    .select('id, status, created_at, start_date, location_text, budget, clients(name, kind), staff_categories(name), staff_profiles(full_name)')
    .eq('agency_id', session.agency_id)
    .order('created_at', { ascending: false })
    .limit(200)
  if (tab.statuses.length) query = query.in('status', [...tab.statuses])
  const { data: bookings } = await query

  return (
    <div className="grid gap-8">
      <PageHeader title="Bookings" description="Client requests, from first enquiry to active placement." />
      <nav className="flex flex-wrap gap-2" aria-label="Booking status">
        {TABS.map((t) => (
          <Link
            key={t.value}
            href={`/admin/bookings?tab=${t.value}`}
            className={cn('rounded-full px-4 py-2 text-sm font-semibold', t.value === tab.value ? 'bg-navy-800 text-white' : 'bg-white text-navy-600 hover:bg-brand-50')}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {bookings?.length ? (
        <div className="overflow-x-auto rounded-3xl border border-brand-100 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-blush text-xs uppercase tracking-wider text-navy-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Client</th>
                <th className="px-5 py-3 font-semibold">Needs</th>
                <th className="px-5 py-3 font-semibold">Staff</th>
                <th className="px-5 py-3 font-semibold">Area</th>
                <th className="px-5 py-3 font-semibold">Start</th>
                <th className="px-5 py-3 font-semibold">Requested</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {bookings.map((b) => (
                <tr key={b.id} className="hover:bg-blush/50">
                  <td className="px-5 py-3">
                    <Link href={`/admin/bookings/${b.id}`} className="font-semibold text-navy-800 hover:text-brand-600">{b.clients?.name ?? 'Client'}</Link>
                    <span className="block text-xs capitalize text-navy-400">{b.clients?.kind}</span>
                  </td>
                  <td className="px-5 py-3 text-navy-600">
                    {b.staff_categories?.name ?? '—'}
                    {b.budget && <span className="block text-xs text-navy-400">Budget {formatKes(b.budget)}</span>}
                  </td>
                  <td className="px-5 py-3 text-navy-600">{b.staff_profiles?.full_name ?? <span className="text-gold-700">Unassigned</span>}</td>
                  <td className="px-5 py-3 text-navy-600">{b.location_text}</td>
                  <td className="px-5 py-3 text-navy-500">{formatDate(b.start_date)}</td>
                  <td className="px-5 py-3 text-navy-500">{formatDate(b.created_at)}</td>
                  <td className="px-5 py-3"><StatusPill status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No bookings here.</EmptyState>
      )}
    </div>
  )
}
