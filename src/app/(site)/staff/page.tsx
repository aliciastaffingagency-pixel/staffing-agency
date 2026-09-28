import type { Metadata } from 'next'
import Link from 'next/link'
import { SlidersHorizontal, Sparkles } from 'lucide-react'
import { SectionHeading } from '@/components/landing/sections'
import { Reveal, Stagger, StaggerItem } from '@/components/motion'
import { StaffCard, STAFF_CARD_COLUMNS } from '@/components/staff/staff-card'
import { buttonClass } from '@/components/ui/button'
import { WhatsAppIcon } from '@/components/icons'
import { getAgency, getCategories, whatsappLink } from '@/lib/agency'
import { AREA_NAMES } from '@/lib/areas'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Find staff',
  description: 'Browse vetted house helps, nannies, cooks, drivers, gardeners, guards and more. Filter by role, area, live-in or live-out and budget.',
}

// Monthly budget bands (day-rate-only staff are matched on day rate × 26).
const PRICE_BANDS = [
  { value: 'u10', label: 'Under KES 10,000 / mo', min: 0, max: 10000 },
  { value: '10-15', label: 'KES 10,000 – 15,000', min: 10000, max: 15000 },
  { value: '15-20', label: 'KES 15,000 – 20,000', min: 15000, max: 20000 },
  { value: '20-30', label: 'KES 20,000 – 30,000', min: 20000, max: 30000 },
  { value: '30+', label: 'KES 30,000+', min: 30000, max: Infinity },
] as const

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : '')

export default async function StaffCatalogPage({ searchParams }: PageProps<'/staff'>) {
  const sp = await searchParams
  const f = {
    category: one(sp.category),
    area: one(sp.area).trim().slice(0, 60),
    q: one(sp.q).trim().slice(0, 60),
    availability: one(sp.availability) === 'any' ? 'any' : 'available',
    live: (['live_in', 'live_out'].includes(one(sp.live)) ? one(sp.live) : '') as '' | 'live_in' | 'live_out',
    price: one(sp.price),
  }

  const [agency, categories] = await Promise.all([getAgency(), getCategories()])
  const supabase = await createClient()
  const clean = (s: string) => s.replace(/[%,()*]/g, ' ')

  let query = supabase.from('staff_catalog').select(STAFF_CARD_COLUMNS).eq('agency_id', agency.id)
  if (f.category) query = query.eq('category_slug', f.category)
  if (f.area) query = query.ilike('location_text', `%${clean(f.area)}%`)
  if (f.q) query = query.or(`full_name.ilike.%${clean(f.q)}%,bio.ilike.%${clean(f.q)}%,category_name.ilike.%${clean(f.q)}%`)
  if (f.availability === 'available') query = query.eq('availability', 'available')
  // A live-in request also suits people happy with either arrangement.
  if (f.live) query = query.in('live_arrangement', [f.live, 'either'])
  const { data } = await query.order('rating_avg', { ascending: false }).order('rating_count', { ascending: false }).limit(120)

  const band = PRICE_BANDS.find((b) => b.value === f.price)
  const staff = (data ?? []).filter((s) => {
    if (!band) return true
    const monthly = s.month_rate ?? (s.day_rate != null ? s.day_rate * 26 : null)
    return monthly != null && monthly >= band.min && monthly < band.max
  })
  const filtered = Boolean(f.category || f.area || f.q || f.live || f.price || f.availability === 'any')

  return (
    <section className="bg-sparkle">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <SectionHeading eyebrow="Staff catalog" title="Meet vetted staff," script="ready to serve">
          Every profile shows the checks that person has passed, their rates and what past clients say.
        </SectionHeading>

        <Reveal className="mt-10">
          <form className="grid gap-3 rounded-[2rem] border border-brand-100 bg-white p-4 shadow-soft sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr_auto]">
            <select name="category" defaultValue={f.category} aria-label="Role" className="h-12 rounded-2xl border border-navy-100 bg-white px-4 text-sm text-navy-800">
              <option value="">All roles</option>
              {categories.map((c) => (
                <option key={c.id} value={c.slug}>{c.name}</option>
              ))}
            </select>
            <input name="area" defaultValue={f.area} list="catalog-areas" placeholder="Area, e.g. Kilimani" aria-label="Area" className="h-12 rounded-2xl border border-navy-100 px-4 text-sm outline-none focus:border-brand-400" />
            <datalist id="catalog-areas">
              {AREA_NAMES.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
            <select name="live" defaultValue={f.live} aria-label="Live-in or live-out" className="h-12 rounded-2xl border border-navy-100 bg-white px-4 text-sm text-navy-800">
              <option value="">Live-in or out</option>
              <option value="live_in">Live-in</option>
              <option value="live_out">Live-out</option>
            </select>
            <select name="price" defaultValue={f.price} aria-label="Budget" className="h-12 rounded-2xl border border-navy-100 bg-white px-4 text-sm text-navy-800">
              <option value="">Any budget</option>
              {PRICE_BANDS.map((b) => (
                <option key={b.value} value={b.value}>{b.label}</option>
              ))}
            </select>
            <select name="availability" defaultValue={f.availability} aria-label="Availability" className="h-12 rounded-2xl border border-navy-100 bg-white px-4 text-sm text-navy-800">
              <option value="available">Available now</option>
              <option value="any">Include placed staff</option>
            </select>
            <button className={buttonClass('primary', 'md', 'h-12')}>
              <SlidersHorizontal className="size-4" /> Filter
            </button>
            <input name="q" defaultValue={f.q} placeholder="Search by name, skill or keyword…" aria-label="Search" className="h-12 rounded-2xl border border-navy-100 px-4 text-sm outline-none focus:border-brand-400 sm:col-span-2 lg:col-span-6" />
          </form>
        </Reveal>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-navy-500">
          <p>
            {staff.length} {staff.length === 1 ? 'person' : 'people'} found
            {filtered && (
              <Link href="/staff" className="ml-3 font-semibold text-brand-600 hover:underline">Clear filters</Link>
            )}
          </p>
          <Link href="/match" className="inline-flex items-center gap-1.5 rounded-full border-2 border-navy-800/15 bg-white px-4 py-2 font-semibold text-navy-800 hover:border-brand-400 hover:text-brand-600">
            <Sparkles className="size-4 text-gold-500" /> Describe what you need instead
          </Link>
        </div>

        {staff.length ? (
          <Stagger className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {staff.map((s) => (
              <StaggerItem key={s.id}>
                <StaffCard s={s} showCategory={!f.category} />
              </StaggerItem>
            ))}
          </Stagger>
        ) : (
          <Reveal className="mt-8 rounded-[2rem] border border-dashed border-brand-200 bg-white/80 px-6 py-14 text-center">
            <p className="font-script text-3xl text-brand-500">No exact match yet</p>
            <p className="mx-auto mt-3 max-w-lg text-navy-600">
              Try widening your filters, or tell us what you need. We often have people who aren&apos;t listed yet.
            </p>
            <a href={whatsappLink(agency, `Hello ${agency.name}, I'm looking for staff but couldn't find a match online.`)} target="_blank" rel="noopener" className={buttonClass('whatsapp', 'lg', 'mt-7')}>
              <WhatsAppIcon className="size-5" /> Ask us on WhatsApp
            </a>
          </Reveal>
        )}
      </div>
    </section>
  )
}
