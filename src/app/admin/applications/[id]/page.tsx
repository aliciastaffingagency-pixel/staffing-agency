import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, FileText, Mail, Phone, UserPlus } from 'lucide-react'
import { ConfirmDelete } from '@/components/admin/confirm-delete'
import { PageHeader, Panel, StatusPill } from '@/components/portal/portal-shell'
import { Button, ButtonLink } from '@/components/ui/button'
import { WhatsAppIcon } from '@/components/icons'
import { requireRole } from '@/lib/auth'
import { ENGAGEMENT_LABEL } from '@/lib/jobs'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatDateTime, formatKes } from '@/lib/utils'
import { convertToStaff, removeApplication } from '../../jobs/actions'
import { ApplicationReviewForm } from './review-form'

export const metadata: Metadata = { title: 'Application' }

type Doc = { label: string; path: string; name: string; size: number }

export default async function ApplicationPage({ params }: PageProps<'/admin/applications/[id]'>) {
  const session = await requireRole('super_admin')
  const { id } = await params
  const supabase = await createClient()
  const [{ data: app }, { data: categories }] = await Promise.all([
    supabase.from('job_applications').select('*, vacancies(id, title, category_id)').eq('id', id).eq('agency_id', session.agency_id).maybeSingle(),
    supabase.from('staff_categories').select('id, name').eq('agency_id', session.agency_id).order('sort_order'),
  ])
  if (!app) notFound()

  // Opening an application marks it as being reviewed.
  if (app.status === 'new') {
    await supabase.from('job_applications').update({ status: 'reviewing', reviewed_by: session.id, reviewed_at: new Date().toISOString() }).eq('id', id)
    app.status = 'reviewing'
  }

  const docs = (Array.isArray(app.documents) ? app.documents : []) as Doc[]
  // Short-lived links, signed at render time (documents are private).
  const { data: signed } = docs.length
    ? await supabase.storage.from('applications').createSignedUrls(docs.map((d) => d.path), 60 * 30)
    : { data: [] }
  const urlFor = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]))
  const waNumber = app.phone.replace(/^\+/, '')

  return (
    <div className="grid gap-6">
      <Link href="/admin/applications" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-brand-600">
        <ArrowLeft className="size-4" /> All applications
      </Link>
      <PageHeader
        title={app.full_name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusPill status={app.status} />
            <span>
              {app.vacancies ? (
                <>Applied for <Link href={`/admin/jobs/${app.vacancies.id}`} className="font-semibold text-brand-600 hover:underline">{app.vacancies.title}</Link></>
              ) : (
                'General application'
              )}{' '}
              · {formatDateTime(app.created_at)}
            </span>
          </span>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <ButtonLink href={`tel:${app.phone}`} variant="outline" size="sm"><Phone className="size-4" /> Call</ButtonLink>
            <ButtonLink href={`https://wa.me/${waNumber}`} target="_blank" variant="whatsapp" size="sm"><WhatsAppIcon className="size-4" /> WhatsApp</ButtonLink>
            {app.email && <ButtonLink href={`mailto:${app.email}`} variant="outline" size="sm"><Mail className="size-4" /> Email</ButtonLink>}
          </div>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <div className="grid gap-6">
          <Panel title="How they want to work">
            <div className="rounded-2xl bg-gradient-to-br from-brand-50 to-gold-100/60 p-5">
              <p className="font-bold text-navy-800">{ENGAGEMENT_LABEL[app.engagement].title}</p>
              {app.expected_pay != null && (
                <p className="mt-1 text-sm text-navy-600">
                  Expected pay: <strong>{formatKes(app.expected_pay)}</strong> / {app.expected_pay_period ?? 'month'}
                </p>
              )}
              {app.preferred_terms && <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-navy-700">{app.preferred_terms}</p>}
            </div>
          </Panel>

          <Panel title="Details">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Detail label="Phone">{app.phone}</Detail>
              <Detail label="Email">{app.email}</Detail>
              <Detail label="Location">{app.location_text}</Detail>
              <Detail label="Date of birth">{app.date_of_birth && formatDate(app.date_of_birth)}</Detail>
              <Detail label="Experience">{app.years_experience != null && `${app.years_experience} years`}</Detail>
              <Detail label="Languages">{app.languages.join(', ')}</Detail>
              <Detail label="Skills" wide>{app.skills.join(', ')}</Detail>
              <Detail label="About them" wide>
                {app.cover_note && <span className="whitespace-pre-line">{app.cover_note}</span>}
              </Detail>
            </dl>
          </Panel>

          <Panel title={`Documents (${docs.length})`}>
            {docs.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {docs.map((d) => (
                  <li key={d.path}>
                    <a
                      href={urlFor.get(d.path) ?? '#'}
                      target="_blank"
                      rel="noopener"
                      className="flex w-full items-center gap-3 rounded-2xl border border-brand-100 px-4 py-3 text-left hover:border-brand-300 hover:bg-blush"
                    >
                      <FileText className="size-5 shrink-0 text-brand-500" />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-navy-800">{d.label}</span>
                        <span className="block truncate text-xs text-navy-400">{d.name} · {d.size < 1024 * 1024 ? `${Math.max(1, Math.round(d.size / 1024))} KB` : `${(d.size / 1024 / 1024).toFixed(1)} MB`}</span>
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-navy-400">No documents uploaded.</p>
            )}
          </Panel>
        </div>

        <div className="grid gap-6 xl:sticky xl:top-24">
          <Panel title="Review">
            <ApplicationReviewForm id={app.id} status={app.status} notes={app.admin_notes ?? ''} />
          </Panel>
          <Panel title="Add to your staff">
            {app.staff_id ? (
              <ButtonLink href={`/admin/staff/${app.staff_id}`} variant="navy" size="sm">Open staff profile</ButtonLink>
            ) : (
              <form action={convertToStaff} className="grid gap-3">
                <p className="text-sm text-navy-500">Creates a hidden staff profile from this application, including their ID document. Finish it and record vetting checks before publishing.</p>
                <input type="hidden" name="id" value={app.id} />
                <select name="category_id" required defaultValue={app.vacancies?.category_id ?? ''} className="h-11 rounded-2xl border border-navy-100 px-3 text-sm">
                  <option value="" disabled>Choose their category…</option>
                  {categories?.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <Button size="sm"><UserPlus className="size-4" /> Create staff profile</Button>
              </form>
            )}
          </Panel>

          <ConfirmDelete
            action={removeApplication}
            id={app.id}
            phrase="DELETE"
            title="Delete this application"
            button="Delete application"
            deletes={['The application and every uploaded document', 'Personal details stored in the activity log']}
            keeps={app.staff_id ? ['The staff profile created from it (delete that separately if needed)'] : undefined}
          />
        </div>
      </div>
    </div>
  )
}

function Detail({ label, children, wide }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-xs font-semibold uppercase tracking-wider text-navy-400">{label}</dt>
      <dd className="mt-1 text-navy-700">{children || '—'}</dd>
    </div>
  )
}
