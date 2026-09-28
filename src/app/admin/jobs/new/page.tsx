import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/components/portal/portal-shell'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { VacancyForm } from '../vacancy-form'

export const metadata: Metadata = { title: 'Post a vacancy' }

export default async function NewVacancyPage() {
  const session = await requireRole('super_admin')
  const supabase = await createClient()
  const { data: categories } = await supabase.from('staff_categories').select('id, name').eq('agency_id', session.agency_id).order('sort_order')
  return (
    <div className="mx-auto grid max-w-4xl gap-6">
      <Link href="/admin/jobs" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-brand-600">
        <ArrowLeft className="size-4" /> All vacancies
      </Link>
      <PageHeader title="Post a vacancy" description="Open vacancies show on the public Jobs page, where anyone can apply and upload their documents." />
      <VacancyForm categories={categories ?? []} />
    </div>
  )
}
