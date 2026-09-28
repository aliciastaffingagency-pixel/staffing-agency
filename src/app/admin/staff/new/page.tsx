import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/portal/portal-shell'
import { getAgency } from '@/lib/agency'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { StaffForm } from '../staff-form'

export const metadata: Metadata = { title: 'Add staff' }

export default async function NewStaffPage() {
  const session = await requireRole('super_admin')
  const supabase = await createClient()
  const [agency, { data: categories }] = await Promise.all([
    getAgency(),
    supabase.from('staff_categories').select('id, name, is_active').eq('agency_id', session.agency_id).order('sort_order'),
  ])

  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <Link href="/admin/staff" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-brand-600">
        <ArrowLeft className="size-4" /> All staff
      </Link>
      <PageHeader title="Add a staff member" description="After creating the profile you can record vetting checks. Checks unlock the Verified, Background-checked and Trained badges." />
      <StaffForm agencyId={session.agency_id} categories={categories ?? []} mapCenter={agency.settings.map_center ?? [-1.286389, 36.817223]} />
    </div>
  )
}
