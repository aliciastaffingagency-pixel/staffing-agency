import type { Metadata } from 'next'
import Link from 'next/link'
import { Star } from 'lucide-react'
import { BarList, ColumnChart, type BarDatum } from '@/components/charts/bar-list'
import { DemandMap } from '@/components/map/demand-map'
import type { DemandPoint } from '@/components/map/demand-map-inner'
import { EmptyState, PageHeader, Panel, StatCard } from '@/components/portal/portal-shell'
import { getAgency } from '@/lib/agency'
import { matchArea } from '@/lib/areas'
import { requireRole } from '@/lib/auth'
import type { TemplateDefaults } from '@/lib/contracts-shared'
import { createClient } from '@/lib/supabase/server'
import { cn, formatKes } from '@/lib/utils'

export const metadata: Metadata = { title: 'Analytics' }

const RANGES = [
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: '365', label: 'Last 12 months' },
] as const

const DAY = 86_400_000

function tally<T>(rows: T[], key: (r: T) => string | null | undefined) {
  const m = new Map<string, number>()
  for (const r of rows) {
    const k = key(r)
    if (k) m.set(k, (m.get(k) ?? 0) + 1)
  }
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
}

function sinceIso(days: number) {
  return new Date(Date.now() - days * DAY).toISOString()
}

export default async function AnalyticsPage({ searchParams }: PageProps<'/admin/analytics'>) {
  const session = await requireRole('super_admin')
  const sp = await searchParams
  const range = RANGES.find((r) => r.value === sp.range) ?? RANGES[1]
  const since = sinceIso(Number(range.value))
  const sixMonthsAgo = new Date(new Date().getFullYear(), new Date().getMonth() - 5, 1).toISOString()
  const a = session.agency_id

  const supabase = await createClient()
  const [agency, bookings, contracts, payments, queries, threads, topStaff, apps, leads, template] = await Promise.all([
    getAgency(),
    supabase.from('booking_requests').select('id, status, staff_id, location_text, created_at, staff_categories(name)').eq('agency_id', a).gte('created_at', since),
    supabase.from('contracts').select('id, booking_request_id, status, client_signed_at, starts_on, ended_at, created_at').eq('agency_id', a).gte('created_at', sinceIso(730)),
    supabase.from('payments').select('amount, paid_at').eq('agency_id', a).eq('status', 'paid').gte('paid_at', sixMonthsAgo),
    supabase.from('match_queries').select('category_slug, area, results').eq('agency_id', a).gte('created_at', since),
    supabase.from('message_threads').select('kind').eq('agency_id', a).gte('created_at', since).in('kind', ['replacement', 'dispute']),
    supabase.from('staff_profiles').select('id, full_name, rating_avg, rating_count, staff_categories(name)').eq('agency_id', a).gt('rating_count', 0).order('rating_avg', { ascending: false }).order('rating_count', { ascending: false }).limit(8),
    supabase.from('job_applications').select('engagement').eq('agency_id', a).gte('created_at', since),
    supabase.from('leads').select('status').eq('agency_id', a).gte('created_at', since),
    supabase.from('contract_templates').select('defaults').eq('agency_id', a).eq('is_active', true).order('version', { ascending: false }).limit(1).maybeSingle(),
  ])

  const b = bookings.data ?? []
  const c = contracts.data ?? []
  const q = queries.data ?? []
  const contractsByBooking = new Map<string, typeof c>()
  for (const x of c) contractsByBooking.set(x.booking_request_id, [...(contractsByBooking.get(x.booking_request_id) ?? []), x])

  // Funnel over requests made in the range.
  const funnelCounts = {
    requested: b.length,
    matched: b.filter((x) => x.staff_id).length,
    contracted: b.filter((x) => contractsByBooking.get(x.id)?.some((k) => k.status !== 'cancelled')).length,
    signed: b.filter((x) => contractsByBooking.get(x.id)?.some((k) => k.client_signed_at)).length,
    placed: b.filter((x) => x.status === 'active' || x.status === 'completed').length,
  }
  const funnel: BarDatum[] = [
    { label: 'Requested', value: funnelCounts.requested },
    { label: 'Matched', value: funnelCounts.matched },
    { label: 'Contract sent', value: funnelCounts.contracted },
    { label: 'Signed', value: funnelCounts.signed },
    { label: 'Paid & placed', value: funnelCounts.placed },
  ].map((f) => ({ ...f, hint: funnelCounts.requested ? `${Math.round((f.value / funnelCounts.requested) * 100)}% of requests` : undefined }))
  const conversion = funnelCounts.requested ? Math.round((funnelCounts.placed / funnelCounts.requested) * 100) : 0

  // Demand by role (bookings) and unmet searches.
  const byRole = tally(b, (x) => x.staff_categories?.name)
  const unmetByRole = tally(q.filter((x) => x.results === 0), (x) => x.category_slug?.replaceAll('-', ' ') ?? 'unspecified role')

  // Demand by area → map points.
  const areaName = (t: string | null) => matchArea(t)?.name ?? (t?.split(',')[0].trim() || null)
  const byArea = tally(b, (x) => areaName(x.location_text))
  const unmetArea = new Map(tally(q.filter((x) => x.results === 0), (x) => areaName(x.area)).map((x) => [x.label, x.value]))
  const points: DemandPoint[] = []
  for (const name of new Set([...byArea.map((x) => x.label), ...unmetArea.keys()])) {
    const hit = matchArea(name)
    if (hit) points.push({ name, coords: hit.coords, requests: byArea.find((x) => x.label === name)?.value ?? 0, unmet: unmetArea.get(name) ?? 0 })
  }

  // Revenue by month (last 6 months).
  const months: BarDatum[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(new Date().getFullYear(), new Date().getMonth() - 5 + i, 1)
    return { label: d.toLocaleDateString('en-KE', { month: 'short' }), value: 0, key: `${d.getFullYear()}-${d.getMonth()}` } as BarDatum & { key: string }
  })
  for (const p of payments.data ?? []) {
    const d = new Date(p.paid_at!)
    const m = (months as (BarDatum & { key: string })[]).find((x) => x.key === `${d.getFullYear()}-${d.getMonth()}`)
    if (m) m.value += Number(p.amount)
  }
  const revenueInRange = (payments.data ?? []).filter((p) => p.paid_at! >= since).reduce((s, p) => s + Number(p.amount), 0)

  // Churn: placements that ended in the range, and how many ended inside the trial.
  const trialDays = ((template.data?.defaults ?? {}) as Partial<TemplateDefaults>).trial_period_days ?? 14
  const ended = c.filter((x) => x.ended_at && x.ended_at >= since)
  const durations = ended.map((x) => (new Date(x.ended_at!).getTime() - new Date(x.starts_on ?? x.created_at).getTime()) / DAY)
  const earlyExits = durations.filter((d) => d <= trialDays).length
  const avgDays = durations.length ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : null
  const replacements = (threads.data ?? []).filter((t) => t.kind === 'replacement').length
  const disputes = (threads.data ?? []).filter((t) => t.kind === 'dispute').length

  const joinCount = (apps.data ?? []).filter((x) => x.engagement === 'join_agency').length

  return (
    <div className="grid gap-8">
      <PageHeader title="Analytics" description="Where demand comes from, how requests convert, and how placements hold up." />

      <nav className="flex flex-wrap gap-2" aria-label="Date range">
        {RANGES.map((r) => (
          <Link key={r.value} href={`/admin/analytics?range=${r.value}`} className={cn('rounded-full px-4 py-2 text-sm font-semibold', r.value === range.value ? 'bg-navy-800 text-white' : 'bg-white text-navy-600 hover:bg-brand-50')}>
            {r.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Booking requests" value={funnelCounts.requested} hint={range.label} />
        <StatCard label="Request → placement" value={`${conversion}%`} hint={`${funnelCounts.placed} placed`} />
        <StatCard label="Fees received" value={formatKes(revenueInRange)!} hint={range.label} />
        <StatCard label="Leads & applicants" value={(leads.data?.length ?? 0) + (apps.data?.length ?? 0)} hint={`${leads.data?.length ?? 0} callback leads · ${apps.data?.length ?? 0} job applications`} />
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title="Conversion funnel">
          <BarList data={funnel} emptyText="No requests in this period." />
        </Panel>
        <Panel title="Fees received by month">
          <ColumnChart data={months.map(({ label, value }) => ({ label, value }))} unit="kes" />
        </Panel>
      </div>

      <Panel title="Demand map">
        <p className="-mt-2 mb-4 text-sm text-navy-500">Bigger circles mean more booking requests and unmatched searches from that area. Use it to decide where to recruit.</p>
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="h-80 overflow-hidden rounded-2xl border border-brand-100">
            <DemandMap center={agency.settings.map_center ?? [-1.286389, 36.817223]} points={points} />
          </div>
          <BarList data={byArea.slice(0, 10)} emptyText="No requests with an area yet." />
        </div>
      </Panel>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title="Demand by role">
          <BarList data={byRole.slice(0, 12)} emptyText="No requests in this period." />
        </Panel>
        <Panel title="Searches that found nobody">
          <p className="-mt-2 mb-3 text-sm text-navy-500">Roles people described on Smart match when no available staff fitted. Recruit here first.</p>
          <BarList data={unmetByRole.slice(0, 8)} emptyText="Every search found someone." />
        </Panel>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title="Top-rated staff">
          {topStaff.data?.length ? (
            <ol className="grid gap-2">
              {topStaff.data.map((s, i) => (
                <li key={s.id}>
                  <Link href={`/admin/staff/${s.id}`} className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 hover:bg-blush">
                    <span className="flex items-center gap-3">
                      <span className="w-5 text-right text-sm font-bold text-navy-400">{i + 1}</span>
                      <span>
                        <span className="block text-sm font-semibold text-navy-800">{s.full_name}</span>
                        <span className="text-xs text-navy-400">{s.staff_categories?.name}</span>
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-navy-700">
                      <Star className="size-4 fill-gold-400 text-gold-500" /> {Number(s.rating_avg).toFixed(1)}
                      <span className="font-normal text-navy-400">({s.rating_count})</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <EmptyState>No published reviews yet.</EmptyState>
          )}
        </Panel>
        <Panel title="Retention & churn">
          <dl className="grid grid-cols-2 gap-3">
            <Tile label="Placements ended" value={ended.length} />
            <Tile label={`Ended within ${trialDays}-day trial`} value={ended.length ? `${earlyExits} (${Math.round((earlyExits / ended.length) * 100)}%)` : '—'} />
            <Tile label="Average placement length" value={avgDays != null ? `${avgDays} days` : '—'} />
            <Tile label="Replacement requests" value={replacements} />
            <Tile label="Disputes raised" value={disputes} />
            <Tile label="Applicants wanting to join" value={`${joinCount} of ${apps.data?.length ?? 0}`} />
          </dl>
        </Panel>
      </div>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-blush px-4 py-3">
      <dt className="text-xs text-navy-500">{label}</dt>
      <dd className="mt-0.5 text-xl font-extrabold text-navy-800">{value}</dd>
    </div>
  )
}
