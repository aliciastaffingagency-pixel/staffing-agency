import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CalendarClock, FileText, Home, MapPin, Users, Wallet } from 'lucide-react'
import { Reveal } from '@/components/motion'
import { getAgency } from '@/lib/agency'
import { EMPLOYMENT_LABEL, payRange } from '@/lib/jobs'
import { createPublicClient } from '@/lib/supabase/public'
import { formatDate, LIVE_LABEL } from '@/lib/utils'
import { ApplicationForm } from '../application-form'

// Public page: served from the CDN, refreshed every 5 minutes and immediately after admin changes.
export const revalidate = 300

// No pages are built ahead of time; each one is rendered on its first visit and then cached (ISR).
export async function generateStaticParams() {
  return []
}

async function getVacancy(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const agency = await getAgency()
  const supabase = createPublicClient()
  // RLS only returns open, unexpired vacancies to the public.
  const { data } = await supabase
    .from('vacancies')
    .select('*, staff_categories(name)')
    .eq('id', id)
    .eq('agency_id', agency.id)
    .eq('status', 'open')
    .maybeSingle()
  return data
}

export async function generateMetadata({ params }: PageProps<'/jobs/[id]'>): Promise<Metadata> {
  const v = await getVacancy((await params).id)
  return v ? { title: v.title, description: v.description.slice(0, 160) } : {}
}

export default async function VacancyPage({ params }: PageProps<'/jobs/[id]'>) {
  const { id } = await params
  const v = await getVacancy(id)
  if (!v) notFound()
  const pay = payRange(v.pay_min, v.pay_max, v.pay_period)

  return (
    <section className="bg-sparkle">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.25fr]">
        <div>
          <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-brand-600">
            <ArrowLeft className="size-4" /> All vacancies
          </Link>
          <Reveal className="mt-6 rounded-[2rem] border border-brand-100 bg-white p-7 lg:sticky lg:top-32">
            {v.staff_categories?.name && <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">{v.staff_categories.name}</p>}
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy-800">{v.title}</h1>
            <ul className="mt-5 grid gap-2 text-sm text-navy-600">
              {v.location_text && <Item icon={MapPin}>{v.location_text}</Item>}
              <Item icon={CalendarClock}>{EMPLOYMENT_LABEL[v.employment_type]}</Item>
              <Item icon={Home}>{LIVE_LABEL[v.live_arrangement]}</Item>
              {pay && <Item icon={Wallet}>{pay}</Item>}
              <Item icon={Users}>{v.positions} position{v.positions === 1 ? '' : 's'}</Item>
            </ul>
            <div className="mt-6 whitespace-pre-line leading-relaxed text-navy-700">{v.description}</div>
            {v.requirements && (
              <>
                <h2 className="mt-6 font-bold text-navy-800">Requirements</h2>
                <div className="mt-2 whitespace-pre-line text-sm leading-relaxed text-navy-600">{v.requirements}</div>
              </>
            )}
            {v.required_documents.length > 0 && (
              <>
                <h2 className="mt-6 font-bold text-navy-800">Documents you&apos;ll need</h2>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {v.required_documents.map((d) => (
                    <li key={d} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                      <FileText className="size-3.5" /> {d}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {v.closes_on && <p className="mt-6 text-sm font-medium text-gold-700">Applications close {formatDate(v.closes_on)}</p>}
          </Reveal>
        </div>
        <div className="lg:pt-12">
          <h2 className="mb-6 text-2xl font-extrabold text-navy-800">
            Apply <span className="font-script text-brand-500">now</span>
          </h2>
          <ApplicationForm vacancyId={v.id} requiredDocuments={v.required_documents} />
        </div>
      </div>
    </section>
  )
}

function Item({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Icon className="size-4 text-brand-400" /> {children}
    </li>
  )
}
