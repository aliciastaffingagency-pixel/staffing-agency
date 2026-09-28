import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ExternalLink, FileText } from 'lucide-react'
import { PageHeader, Panel, StatusPill } from '@/components/portal/portal-shell'
import { Button } from '@/components/ui/button'
import { getAgency } from '@/lib/agency'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { setStaffActive } from '../actions'
import { StaffForm } from '../staff-form'
import { StaffLoginForm, VettingCheckForm } from './panels'

export const metadata: Metadata = { title: 'Edit staff' }

const VETTING_STEPS = [
  { type: 'id_verification', title: 'ID verified in person', badge: 'Verified' },
  { type: 'reference_check', title: 'References called', badge: 'Background-checked (with background check)' },
  { type: 'background_check', title: 'Background / police check', badge: 'Background-checked (with references)' },
  { type: 'training', title: 'Agency training completed', badge: 'Trained' },
] as const

export default async function EditStaffPage({ params, searchParams }: PageProps<'/admin/staff/[id]'>) {
  const session = await requireRole('super_admin')
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()

  const [agency, { data: staff }, { data: categories }, { data: checks }, { data: placements }] = await Promise.all([
    getAgency(),
    supabase.from('staff_profiles').select('*').eq('id', id).eq('agency_id', session.agency_id).maybeSingle(),
    supabase.from('staff_categories').select('id, name, is_active').eq('agency_id', session.agency_id).order('sort_order'),
    supabase.from('staff_vetting_checks').select('check_type, passed, notes, confirmed_at').eq('staff_id', id),
    supabase.from('booking_requests').select('id, status, start_date, clients(name)').eq('staff_id', id).order('created_at', { ascending: false }).limit(10),
  ])
  if (!staff) notFound()

  const { data: idDoc } = staff.id_doc_url ? await supabase.storage.from('staff-docs').createSignedUrl(staff.id_doc_url, 60 * 30) : { data: null }
  const checkMap = new Map((checks ?? []).map((c) => [c.check_type, c]))

  return (
    <div className="grid gap-6">
      <Link href="/admin/staff" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-brand-600">
        <ArrowLeft className="size-4" /> All staff
      </Link>
      <PageHeader
        title={staff.full_name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusPill status={staff.vetting_status} />
            {!staff.is_active && <StatusPill status="hidden" />}
            {staff.is_active && (
              <Link href={`/staff/${staff.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
                View public profile <ExternalLink className="size-3.5" />
              </Link>
            )}
          </span>
        }
        action={
          <form action={setStaffActive}>
            <input type="hidden" name="id" value={staff.id} />
            <input type="hidden" name="active" value={String(!staff.is_active)} />
            <Button variant={staff.is_active ? 'outline' : 'primary'} size="sm">
              {staff.is_active ? 'Deactivate' : 'Reactivate'}
            </Button>
          </form>
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_380px]">
        <StaffForm
          staff={staff}
          agencyId={session.agency_id}
          categories={categories ?? []}
          mapCenter={agency.settings.map_center ?? [-1.286389, 36.817223]}
          idDocPreview={null}
          initialMessage={sp.created ? 'Profile created. Now record the vetting checks on the right.' : undefined}
        />

        <div className="grid gap-6 xl:sticky xl:top-24">
          <Panel title="Vetting & badges">
            <p className="mb-4 text-sm text-navy-500">Badges appear on the public profile only when you confirm the matching checks.</p>
            <ul className="grid gap-3">
              {VETTING_STEPS.map((step) => {
                const c = checkMap.get(step.type)
                return (
                  <li key={step.type}>
                    <VettingCheckForm
                      staffId={staff.id}
                      type={step.type}
                      title={step.title}
                      badge={step.badge}
                      state={c ? (c.passed ? 'passed' : 'failed') : 'clear'}
                      notes={c?.notes ?? ''}
                      confirmedAt={c ? formatDate(c.confirmed_at) : null}
                    />
                  </li>
                )
              })}
            </ul>
            {idDoc?.signedUrl && (
              <a href={idDoc.signedUrl} target="_blank" rel="noopener" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:underline">
                <FileText className="size-4" /> Open ID document
              </a>
            )}
          </Panel>

          <Panel title="Staff login">
            {staff.user_id ? (
              <p className="text-sm text-navy-600">This staff member has a read-only login to see their placements, schedule and ratings.</p>
            ) : (
              <StaffLoginForm staffId={staff.id} />
            )}
          </Panel>

          <Panel title="Placements">
            {placements?.length ? (
              <ul className="grid gap-2 text-sm">
                {placements.map((p) => (
                  <li key={p.id}>
                    <Link href={`/admin/bookings/${p.id}`} className="flex items-center justify-between gap-2 rounded-xl bg-blush px-3 py-2 hover:bg-brand-50">
                      <span className="truncate text-navy-700">{p.clients?.name ?? 'Client'}{p.start_date && ` · ${formatDate(p.start_date)}`}</span>
                      <StatusPill status={p.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-navy-400">No placements yet.</p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
