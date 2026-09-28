import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink, Trash2 } from 'lucide-react'
import { PageHeader, Panel, StatusPill } from '@/components/portal/portal-shell'
import { Button } from '@/components/ui/button'
import { requireRole } from '@/lib/auth'
import { ENGAGEMENT_LABEL } from '@/lib/jobs'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { deleteVacancy, setVacancyStatus } from '../actions'
import { VacancyForm } from '../vacancy-form'

export const metadata: Metadata = { title: 'Edit vacancy' }

export default async function EditVacancyPage({ params, searchParams }: PageProps<'/admin/jobs/[id]'>) {
  const session = await requireRole('super_admin')
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()
  const [{ data: vacancy }, { data: categories }, { data: apps }] = await Promise.all([
    supabase.from('vacancies').select('*').eq('id', id).eq('agency_id', session.agency_id).maybeSingle(),
    supabase.from('staff_categories').select('id, name').eq('agency_id', session.agency_id).order('sort_order'),
    supabase.from('job_applications').select('id, full_name, location_text, engagement, status, created_at').eq('vacancy_id', id).order('created_at', { ascending: false }),
  ])
  if (!vacancy) notFound()

  return (
    <div className="grid gap-6">
      <Link href="/admin/jobs" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-brand-600">
        <ArrowLeft className="size-4" /> All vacancies
      </Link>
      <PageHeader
        title={vacancy.title}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusPill status={vacancy.status === 'filled' ? 'completed' : vacancy.status} />
            {vacancy.status === 'open' && (
              <Link href={`/jobs/${vacancy.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
                View public listing <ExternalLink className="size-3.5" />
              </Link>
            )}
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <form action={setVacancyStatus}>
              <input type="hidden" name="id" value={vacancy.id} />
              {vacancy.status === 'open' ? (
                <Button name="status" value="closed" variant="outline" size="sm">Close applications</Button>
              ) : (
                <Button name="status" value="open" size="sm">Open applications</Button>
              )}
            </form>
            <form action={deleteVacancy}>
              <input type="hidden" name="id" value={vacancy.id} />
              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700" aria-label="Delete vacancy">
                <Trash2 className="size-4" />
              </Button>
            </form>
          </div>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <VacancyForm vacancy={vacancy} categories={categories ?? []} initialMessage={sp.created ? 'Vacancy posted.' : undefined} />
        <Panel title={`Applicants (${apps?.length ?? 0})`}>
          {apps?.length ? (
            <ul className="grid gap-2">
              {apps.map((a) => (
                <li key={a.id}>
                  <Link href={`/admin/applications/${a.id}`} className="flex items-center justify-between gap-3 rounded-2xl bg-blush px-4 py-3 hover:bg-brand-50">
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-navy-800">{a.full_name}</span>
                      <span className="block text-xs text-navy-400">
                        {ENGAGEMENT_LABEL[a.engagement].short} · {formatDate(a.created_at)}
                      </span>
                    </span>
                    <StatusPill status={a.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-navy-400">No applications yet.</p>
          )}
        </Panel>
      </div>
    </div>
  )
}
