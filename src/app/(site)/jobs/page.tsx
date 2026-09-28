import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Briefcase, CalendarClock, Home, MapPin, Users, Wallet } from 'lucide-react'
import { SectionHeading } from '@/components/landing/sections'
import { HoverLift, Reveal, Stagger, StaggerItem } from '@/components/motion'
import { ButtonLink } from '@/components/ui/button'
import { getAgency } from '@/lib/agency'
import { EMPLOYMENT_LABEL, payRange } from '@/lib/jobs'
import { createPublicClient } from '@/lib/supabase/public'
import { formatDate, LIVE_LABEL } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Jobs & vacancies',
  description: 'Open jobs for house helps, nannies, cooks, drivers, gardeners, guards and more. Apply online and upload your documents.',
}

// Public page: served from the CDN, refreshed every 5 minutes and immediately after admin changes.
export const revalidate = 300

export default async function JobsPage() {
  const agency = await getAgency()
  const supabase = createPublicClient()
  const { data: vacancies } = await supabase
    .from('vacancies')
    .select('id, title, location_text, employment_type, live_arrangement, pay_min, pay_max, pay_period, positions, closes_on, published_at, staff_categories(name)')
    .eq('agency_id', agency.id)
    .eq('status', 'open')
    .or(`closes_on.is.null,closes_on.gte.${new Date().toISOString().slice(0, 10)}`)
    .order('published_at', { ascending: false })

  return (
    <section className="bg-sparkle">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <SectionHeading eyebrow="Work with us" title="Current" script="vacancies">
          Looking for work? Apply online in a few minutes. Choose to join our team as a member, or tell us the terms you
          prefer and we&apos;ll agree them with you.
        </SectionHeading>

        {vacancies?.length ? (
          <Stagger className="mt-14 grid gap-4">
            {vacancies.map((v) => {
              const pay = payRange(v.pay_min, v.pay_max, v.pay_period)
              return (
                <StaggerItem key={v.id}>
                  <HoverLift className="rounded-3xl border border-brand-100 bg-white">
                    <Link href={`/jobs/${v.id}`} className="group flex flex-col gap-4 p-6 sm:flex-row sm:items-center">
                      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-50 to-gold-100 text-brand-500 transition-colors group-hover:from-brand-500 group-hover:to-brand-600 group-hover:text-white">
                        <Briefcase className="size-7" />
                      </span>
                      <span className="min-w-0 flex-1">
                        {v.staff_categories?.name && <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">{v.staff_categories.name}</span>}
                        <span className="block text-lg font-bold text-navy-800">{v.title}</span>
                        <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-navy-500">
                          {v.location_text && <Meta icon={MapPin}>{v.location_text}</Meta>}
                          <Meta icon={CalendarClock}>{EMPLOYMENT_LABEL[v.employment_type]}</Meta>
                          <Meta icon={Home}>{LIVE_LABEL[v.live_arrangement]}</Meta>
                          {pay && <Meta icon={Wallet}>{pay}</Meta>}
                          {v.positions > 1 && <Meta icon={Users}>{v.positions} positions</Meta>}
                        </span>
                      </span>
                      <span className="flex items-center gap-3 sm:flex-col sm:items-end">
                        {v.closes_on && <span className="text-xs text-navy-400">Closes {formatDate(v.closes_on, { day: 'numeric', month: 'short' })}</span>}
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-500">
                          Apply <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                        </span>
                      </span>
                    </Link>
                  </HoverLift>
                </StaggerItem>
              )
            })}
          </Stagger>
        ) : (
          <Reveal className="mt-14 rounded-[2rem] border border-dashed border-brand-200 bg-white/80 px-6 py-12 text-center">
            <p className="font-script text-3xl text-brand-500">No open vacancies right now</p>
            <p className="mx-auto mt-3 max-w-lg text-navy-600">New jobs are posted often. You can still send a general application and we&apos;ll contact you when something suits you.</p>
          </Reveal>
        )}

        <Reveal className="mt-10 flex flex-col items-center gap-4 rounded-[2rem] bg-navy-800 px-6 py-10 text-center text-white sm:px-12">
          <p className="font-script text-3xl text-gold-300">Don&apos;t see the right job?</p>
          <p className="max-w-xl text-white/80">Send a general application with your documents. We match members to new clients every week.</p>
          <ButtonLink href="/jobs/apply" variant="gold" size="lg">Apply to join the agency</ButtonLink>
        </Reveal>
      </div>
    </section>
  )
}

function Meta({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className="size-3.5 text-brand-400" /> {children}
    </span>
  )
}
