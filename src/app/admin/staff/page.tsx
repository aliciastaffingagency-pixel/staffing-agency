import type { Metadata } from 'next'
import Link from 'next/link'
import { BadgeCheck, GraduationCap, Plus, ShieldCheck, Star, UserRound } from 'lucide-react'
import { EmptyState, PageHeader, StatusPill } from '@/components/portal/portal-shell'
import { ButtonLink } from '@/components/ui/button'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AVAILABILITY_LABEL, formatKes } from '@/lib/utils'

export const metadata: Metadata = { title: 'Staff' }

export default async function StaffListPage({ searchParams }: PageProps<'/admin/staff'>) {
  const session = await requireRole('super_admin')
  const sp = await searchParams
  const q = typeof sp.q === 'string' ? sp.q.trim() : ''
  const category = typeof sp.category === 'string' ? sp.category : ''
  const show = sp.show === 'inactive' ? 'inactive' : sp.show === 'all' ? 'all' : 'active'

  const supabase = await createClient()
  let query = supabase
    .from('staff_profiles')
    .select('id, full_name, photo_url, location_text, availability, vetting_status, month_rate, day_rate, is_active, verified_badge, trained_badge, background_checked_badge, rating_avg, rating_count, user_id, staff_categories(name)')
    .eq('agency_id', session.agency_id)
    .order('created_at', { ascending: false })
  if (show !== 'all') query = query.eq('is_active', show === 'active')
  if (category) query = query.eq('category_id', category)
  if (q) query = query.or(`full_name.ilike.%${q.replace(/[%,()]/g, '')}%,location_text.ilike.%${q.replace(/[%,()]/g, '')}%`)

  const [{ data: staff }, { data: categories }] = await Promise.all([
    query,
    supabase.from('staff_categories').select('id, name').eq('agency_id', session.agency_id).order('sort_order'),
  ])

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Staff"
        description="Only you can add or edit staff. Profiles marked active appear in the public catalog."
        action={
          <ButtonLink href="/admin/staff/new">
            <Plus className="size-4" /> Add staff
          </ButtonLink>
        }
      />

      <form className="flex flex-wrap gap-2 rounded-3xl border border-brand-100 bg-white p-3">
        <input name="q" defaultValue={q} placeholder="Search name or area…" className="h-10 min-w-48 flex-1 rounded-full border border-navy-100 px-4 text-sm outline-none focus:border-brand-400" />
        <select name="category" defaultValue={category} className="h-10 rounded-full border border-navy-100 px-3 text-sm">
          <option value="">All categories</option>
          {categories?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select name="show" defaultValue={show} className="h-10 rounded-full border border-navy-100 px-3 text-sm">
          <option value="active">Active</option>
          <option value="inactive">Deactivated</option>
          <option value="all">All</option>
        </select>
        <button className="h-10 rounded-full bg-navy-800 px-5 text-sm font-semibold text-white">Filter</button>
      </form>

      {staff?.length ? (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {staff.map((s) => (
            <li key={s.id}>
              <Link href={`/admin/staff/${s.id}`} className="flex h-full gap-4 rounded-3xl border border-brand-100 bg-white p-4 transition hover:border-brand-300 hover:shadow-soft">
                <span className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand-50 text-brand-200">
                  {s.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.photo_url} alt="" className="size-full object-cover" />
                  ) : (
                    <UserRound className="size-8" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-start justify-between gap-2">
                    <span className="truncate font-bold text-navy-800">{s.full_name}</span>
                    {!s.is_active ? <StatusPill status="hidden" /> : <StatusPill status={s.vetting_status} />}
                  </span>
                  <span className="block truncate text-sm text-navy-500">
                    {s.staff_categories?.name} {s.location_text && `· ${s.location_text}`}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-navy-500">
                    <span>{AVAILABILITY_LABEL[s.availability]}</span>
                    {(s.month_rate || s.day_rate) && <span>{formatKes(s.month_rate ?? s.day_rate)}/{s.month_rate ? 'mo' : 'day'}</span>}
                    {s.rating_count > 0 && (
                      <span className="inline-flex items-center gap-0.5">
                        <Star className="size-3 fill-gold-400 text-gold-500" /> {Number(s.rating_avg).toFixed(1)}
                      </span>
                    )}
                    <span className="inline-flex gap-1 text-brand-500">
                      {s.verified_badge && <BadgeCheck className="size-3.5" aria-label="Verified" />}
                      {s.background_checked_badge && <ShieldCheck className="size-3.5" aria-label="Background-checked" />}
                      {s.trained_badge && <GraduationCap className="size-3.5" aria-label="Trained" />}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>
          {q || category || show !== 'active' ? 'No staff match these filters.' : 'No staff yet. Add your first profile to start filling the catalog.'}
        </EmptyState>
      )}
    </div>
  )
}
