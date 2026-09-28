import type { Metadata } from 'next'
import Link from 'next/link'
import { EmptyState, PageHeader, StatusPill } from '@/components/portal/portal-shell'
import { requireRole } from '@/lib/auth'
import { APPLICATION_STATUSES, ENGAGEMENT_LABEL } from '@/lib/jobs'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'Applications' }

export default async function ApplicationsPage({ searchParams }: PageProps<'/admin/applications'>) {
  const session = await requireRole('super_admin')
  const sp = await searchParams
  const status = typeof sp.status === 'string' && (APPLICATION_STATUSES as readonly string[]).includes(sp.status) ? sp.status : ''
  const vacancy = typeof sp.vacancy === 'string' ? sp.vacancy : ''
  const engagement = sp.engagement === 'join_agency' || sp.engagement === 'own_terms' ? sp.engagement : ''

  const supabase = await createClient()
  let query = supabase
    .from('job_applications')
    .select('id, full_name, phone, location_text, engagement, expected_pay, expected_pay_period, status, created_at, documents, vacancies(title)')
    .eq('agency_id', session.agency_id)
    .order('created_at', { ascending: false })
    .limit(200)
  if (status) query = query.eq('status', status as (typeof APPLICATION_STATUSES)[number])
  if (engagement) query = query.eq('engagement', engagement)
  if (vacancy === 'general') query = query.is('vacancy_id', null)
  else if (vacancy) query = query.eq('vacancy_id', vacancy)

  const [{ data: apps }, { data: vacancies }] = await Promise.all([
    query,
    supabase.from('vacancies').select('id, title').eq('agency_id', session.agency_id).order('created_at', { ascending: false }),
  ])

  return (
    <div className="grid gap-8">
      <PageHeader title="Job applications" description="People applying to work with you, with their documents and preferred terms." />

      <form className="flex flex-wrap gap-2 rounded-3xl border border-brand-100 bg-white p-3">
        <select name="vacancy" defaultValue={vacancy} className="h-10 min-w-48 rounded-full border border-navy-100 px-3 text-sm">
          <option value="">All vacancies</option>
          <option value="general">General applications</option>
          {vacancies?.map((v) => (
            <option key={v.id} value={v.id}>{v.title}</option>
          ))}
        </select>
        <select name="status" defaultValue={status} className="h-10 rounded-full border border-navy-100 px-3 text-sm">
          <option value="">Any status</option>
          {APPLICATION_STATUSES.map((s) => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </select>
        <select name="engagement" defaultValue={engagement} className="h-10 rounded-full border border-navy-100 px-3 text-sm">
          <option value="">Any preference</option>
          <option value="join_agency">Join the agency</option>
          <option value="own_terms">Own terms</option>
        </select>
        <button className="h-10 rounded-full bg-navy-800 px-5 text-sm font-semibold text-white">Filter</button>
      </form>

      {apps?.length ? (
        <div className="overflow-x-auto rounded-3xl border border-brand-100 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-blush text-xs uppercase tracking-wider text-navy-500">
              <tr>
                <th className="px-5 py-3 font-semibold">Applicant</th>
                <th className="px-5 py-3 font-semibold">Vacancy</th>
                <th className="px-5 py-3 font-semibold">Preference</th>
                <th className="px-5 py-3 font-semibold">Docs</th>
                <th className="px-5 py-3 font-semibold">Applied</th>
                <th className="px-5 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-50">
              {apps.map((a) => (
                <tr key={a.id} className="hover:bg-blush/50">
                  <td className="px-5 py-3">
                    <Link href={`/admin/applications/${a.id}`} className="font-semibold text-navy-800 hover:text-brand-600">{a.full_name}</Link>
                    <span className="block text-xs text-navy-400">{[a.phone, a.location_text].filter(Boolean).join(' · ')}</span>
                  </td>
                  <td className="px-5 py-3 text-navy-600">{a.vacancies?.title ?? <span className="text-navy-400">General</span>}</td>
                  <td className="px-5 py-3 text-navy-600">{ENGAGEMENT_LABEL[a.engagement].short}</td>
                  <td className="px-5 py-3 text-navy-600">{Array.isArray(a.documents) ? a.documents.length : 0}</td>
                  <td className="px-5 py-3 text-navy-500">{formatDate(a.created_at)}</td>
                  <td className="px-5 py-3"><StatusPill status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>No applications{status || vacancy || engagement ? ' match these filters' : ' yet'}.</EmptyState>
      )}
    </div>
  )
}
