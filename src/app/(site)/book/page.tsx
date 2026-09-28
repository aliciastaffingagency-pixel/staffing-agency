import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, CalendarCheck, FileSignature, UserRound, Wallet } from 'lucide-react'
import { SectionHeading } from '@/components/landing/sections'
import { StaffBadges } from '@/components/staff/staff-card'
import { ButtonLink } from '@/components/ui/button'
import { getAgency, getCategories } from '@/lib/agency'
import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatKes } from '@/lib/utils'
import { BookingForm } from './booking-form'
import type { StaffOption } from './staff-picker'

export const metadata: Metadata = { title: 'Request staff' }

export default async function BookPage({ searchParams }: PageProps<'/book'>) {
  const sp = await searchParams
  const staffParam = typeof sp.staff === 'string' && /^[0-9a-f-]{36}$/i.test(sp.staff) ? sp.staff : null
  const categorySlug = typeof sp.category === 'string' ? sp.category : null
  const next = `/book${staffParam ? `?staff=${staffParam}` : categorySlug ? `?category=${encodeURIComponent(categorySlug)}` : ''}`

  const [agency, categories, session] = await Promise.all([getAgency(), getCategories(), getSession()])
  const supabase = await createClient()
  const { data: staff } = staffParam
    ? await supabase
        .from('staff_catalog')
        .select('id, full_name, photo_url, category_id, category_name, live_arrangement, month_rate, day_rate, verified_badge, trained_badge, background_checked_badge')
        .eq('id', staffParam)
        .eq('agency_id', agency.id)
        .maybeSingle()
    : { data: null }
  const category = categories.find((c) => c.slug === categorySlug)

  // Everyone the client can choose from, grouped by service: available staff first,
  // plus the specifically requested person even if they're currently placed.
  const { data: catalog } = await supabase
    .from('staff_catalog')
    .select('id, category_id, full_name, photo_url, location_text, live_arrangement, month_rate, day_rate, years_experience, rating_avg, rating_count, verified_badge, trained_badge, background_checked_badge, availability')
    .eq('agency_id', agency.id)
    .order('rating_avg', { ascending: false })
    .order('rating_count', { ascending: false })
    .limit(500)
  const staffByCategory: Record<string, StaffOption[]> = {}
  for (const s of catalog ?? []) {
    if (!s.id || !s.category_id || !s.full_name) continue
    if (s.availability !== 'available' && s.id !== staffParam) continue
    ;(staffByCategory[s.category_id] ??= []).push({
      id: s.id,
      full_name: s.full_name,
      photo_url: s.photo_url,
      location_text: s.location_text,
      live_arrangement: s.live_arrangement,
      month_rate: s.month_rate,
      day_rate: s.day_rate,
      years_experience: s.years_experience,
      rating_avg: s.rating_avg,
      rating_count: s.rating_count,
      verified_badge: s.verified_badge,
      trained_badge: s.trained_badge,
      background_checked_badge: s.background_checked_badge,
      available: s.availability === 'available',
    })
  }

  const { data: client } = session?.role === 'client' ? await supabase.from('clients').select('location_text').eq('user_id', session.id).maybeSingle() : { data: null }

  return (
    <section className="bg-sparkle">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <Link href={staff ? `/staff/${staff.id}` : '/staff'} className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-brand-600">
            <ArrowLeft className="size-4" /> Back
          </Link>
          <div className="mt-6">
            <SectionHeading eyebrow="Request staff" title={staff ? `Request ${staff.full_name?.split(' ')[0]}` : 'Tell us who you'} script={staff ? '' : 'need'} center={false}>
              We confirm availability, then send you a contract to sign and pay online.
            </SectionHeading>
          </div>

          {staff && (
            <div className="mt-8 flex items-center gap-4 rounded-3xl border border-brand-100 bg-white p-4">
              <span className="relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand-50">
                {staff.photo_url ? <Image src={staff.photo_url} alt="" fill sizes="80px" className="object-cover" /> : <UserRound className="size-10 text-brand-200" />}
              </span>
              <div className="min-w-0">
                <p className="font-bold text-navy-800">{staff.full_name}</p>
                <p className="text-sm text-navy-500">
                  {staff.category_name}
                  {(staff.month_rate || staff.day_rate) && ` · ${formatKes(staff.month_rate ?? staff.day_rate)} / ${staff.month_rate ? 'month' : 'day'}`}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                  <StaffBadges s={staff} />
                </div>
              </div>
            </div>
          )}

          <ol className="mt-8 grid gap-4 text-sm text-navy-600">
            {[
              { icon: CalendarCheck, t: 'We confirm the match', d: 'Usually the same day, by SMS and in your account.' },
              { icon: FileSignature, t: 'Sign the contract online', d: 'Trial period, replacement policy and rates in writing.' },
              { icon: Wallet, t: 'Pay with M-Pesa or card', d: 'Your placement starts once the fee is received.' },
            ].map((s) => (
              <li key={s.t} className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">
                  <s.icon className="size-5" />
                </span>
                <span>
                  <span className="block font-semibold text-navy-800">{s.t}</span>
                  {s.d}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="lg:pt-10">
          {!session ? (
            <div className="rounded-[2rem] border border-brand-100 bg-white p-8 text-center shadow-soft">
              <p className="font-script text-3xl text-brand-500">Almost there</p>
              <p className="mx-auto mt-3 max-w-sm text-navy-600">Create a free account (or log in) so we can send you the match, the contract and your receipts.</p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <ButtonLink href={`/signup?next=${encodeURIComponent(next)}`} size="lg">Create free account</ButtonLink>
                <ButtonLink href={`/login?next=${encodeURIComponent(next)}`} variant="outline" size="lg">Log in</ButtonLink>
              </div>
            </div>
          ) : session.role !== 'client' ? (
            <div className="rounded-[2rem] border border-brand-100 bg-white p-8 text-center text-navy-600">
              You&apos;re signed in as {session.role === 'super_admin' ? 'the agency admin' : 'a staff member'}. Booking requests are made from client accounts.
            </div>
          ) : (
            <BookingForm
              staffId={staff?.id ?? undefined}
              categoryId={staff?.category_id ?? category?.id}
              categories={categories}
              staffByCategory={staffByCategory}
              defaultLocation={client?.location_text}
              defaultLive={staff?.live_arrangement ?? undefined}
            />
          )}
        </div>
      </div>
    </section>
  )
}
