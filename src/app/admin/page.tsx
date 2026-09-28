import type { Metadata } from 'next'
import Link from 'next/link'
import { CategoryIcon } from '@/components/category-icon'
import { EmptyState, Panel, StatCard } from '@/components/portal/portal-shell'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Admin' }

export default async function AdminHome() {
  const session = await requireRole('super_admin')
  const supabase = await createClient()
  const agencyId = session.agency_id

  const head = { count: 'exact', head: true } as const

  const [staff, clients, pending, categories, audit] = await Promise.all([
    supabase.from('staff_profiles').select('id', head).eq('agency_id', agencyId),
    supabase.from('clients').select('id', head).eq('agency_id', agencyId),
    supabase.from('booking_requests').select('id', head).eq('agency_id', agencyId).eq('status', 'pending'),
    supabase.from('staff_categories').select('id, name, icon, is_active, sort_order').eq('agency_id', agencyId).order('sort_order'),
    supabase.from('audit_log').select('id, action, target_table, created_at').eq('agency_id', agencyId).order('created_at', { ascending: false }).limit(8),
  ])

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-navy-800">Agency overview</h1>
        <p className="mt-1 text-navy-500">Everything happening across your agency, at a glance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Staff profiles" value={staff.count ?? 0} />
        <StatCard label="Clients" value={clients.count ?? 0} />
        <StatCard label="Pending requests" value={pending.count ?? 0} />
        <StatCard label="Service categories" value={categories.data?.filter((c) => c.is_active).length ?? 0} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Service categories" action={<Link href="/admin/categories" className="text-sm font-semibold text-brand-600 hover:underline">Manage</Link>}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {categories.data?.map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-blush px-4 py-3">
                <CategoryIcon name={c.icon} className="size-5 text-brand-500" />
                <span className="text-sm font-medium text-navy-700">{c.name}</span>
                {!c.is_active && <span className="ml-auto text-xs text-navy-400">hidden</span>}
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="Recent activity">
          {audit.data?.length ? (
            <ul className="grid gap-2 text-sm">
              {audit.data.map((a) => (
                <li key={a.id} className="flex justify-between gap-3 border-b border-brand-50 pb-2 last:border-0">
                  <span className="text-navy-700">
                    <span className="font-semibold capitalize">{a.action}</span> · {a.target_table.replaceAll('_', ' ')}
                  </span>
                  <time className="shrink-0 text-navy-400" dateTime={a.created_at}>
                    {new Date(a.created_at).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState>No activity yet.</EmptyState>
          )}
        </Panel>
      </div>
    </div>
  )
}
