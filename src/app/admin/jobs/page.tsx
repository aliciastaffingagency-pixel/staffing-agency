import type { Metadata } from 'next'
import Link from 'next/link'
import { Briefcase, Plus } from 'lucide-react'
import { EmptyState, PageHeader, StatusPill } from '@/components/portal/portal-shell'
import { ButtonLink } from '@/components/ui/button'
import { requireRole } from '@/lib/auth'
import { EMPLOYMENT_LABEL, payRange } from '@/lib/jobs'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Vacancies' }

export default async function AdminJobsPage() {
  const session = await requireRole('super_admin')
  const supabase = await createClient()
  const [{ data: vacancies }, { data: apps }] = await Promise.all([
    supabase.from('vacancies').select('*, staff_categories(name)').eq('agency_id', session.agency_id).order('created_at', { ascending: false }),
    supabase.from('job_applications').select('vacancy_id, status').eq('agency_id', session.agency_id),
  ])

  const counts = new Map<string, { total: number; fresh: number }>()
  for (const a of apps ?? []) {
    const key = a.vacancy_id ?? 'general'
    const c = counts.get(key) ?? { total: 0, fresh: 0 }
    c.total++
    if (a.status === 'new') c.fresh++
    counts.set(key, c)
  }
  const general = counts.get('general')

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Vacancies"
        description="Post open jobs. Anyone can apply online and upload the documents you ask for. Applicants choose to join the agency or propose their own terms."
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/admin/applications" variant="outline">
              All applications
            </ButtonLink>
            <ButtonLink href="/admin/jobs/new">
              <Plus className="size-4" /> Post a vacancy
            </ButtonLink>
          </div>
        }
      />

      {vacancies?.length ? (
        <ul className="grid gap-3">
          {vacancies.map((v) => {
            const c = counts.get(v.id)
            return (
              <li key={v.id}>
                <Link href={`/admin/jobs/${v.id}`} className="flex flex-wrap items-center gap-4 rounded-3xl border border-brand-100 bg-white p-5 transition hover:border-brand-300 hover:shadow-soft">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-500">
                    <Briefcase className="size-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-navy-800">{v.title}</span>
                    <span className="block text-sm text-navy-500">
                      {[v.staff_categories?.name, v.location_text, EMPLOYMENT_LABEL[v.employment_type], payRange(v.pay_min, v.pay_max, v.pay_period)].filter(Boolean).join(' · ')}
                    </span>
                    <span className="block text-xs text-navy-400">
                      {v.closes_on ? `Closes ${formatDate(v.closes_on)}` : 'No closing date'} · {v.positions} position{v.positions === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="text-right text-sm">
                    <span className="block font-bold text-navy-800">{c?.total ?? 0} applicants</span>
                    {c?.fresh ? <span className="text-xs font-semibold text-brand-600">{c.fresh} new</span> : null}
                  </span>
                  <StatusPill status={v.status === 'filled' ? 'completed' : v.status} />
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <EmptyState>No vacancies yet. Post your first job and it appears on the public jobs page straight away.</EmptyState>
      )}

      {general?.total ? (
        <p className="text-sm text-navy-500">
          Plus <Link href="/admin/applications?vacancy=general" className="font-semibold text-brand-600 hover:underline">{general.total} general application{general.total === 1 ? '' : 's'}</Link> from people who want to join the agency without a specific vacancy.
        </p>
      ) : null}
    </div>
  )
}
