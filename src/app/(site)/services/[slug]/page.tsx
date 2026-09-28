import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, BadgeCheck, GraduationCap, MapPin, ShieldCheck, Star, UserRound } from 'lucide-react'
import { CategoryIcon } from '@/components/category-icon'
import { HoverLift, Reveal, Stagger, StaggerItem } from '@/components/motion'
import { buttonClass } from '@/components/ui/button'
import { WhatsAppIcon } from '@/components/icons'
import { getAgency, getCategories, whatsappLink } from '@/lib/agency'
import { createClient } from '@/lib/supabase/server'
import { formatKes } from '@/lib/utils'

async function getCategory(slug: string) {
  const categories = await getCategories()
  return categories.find((c) => c.slug === slug) ?? null
}

export async function generateMetadata({ params }: PageProps<'/services/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const category = await getCategory(slug)
  return category ? { title: category.name, description: category.description ?? undefined } : {}
}

const LIVE_LABEL = { live_in: 'Live-in', live_out: 'Live-out', either: 'Live-in or out' } as const

export default async function CategoryPage({ params }: PageProps<'/services/[slug]'>) {
  const { slug } = await params
  const [agency, category] = await Promise.all([getAgency(), getCategory(slug)])
  if (!category) notFound()

  const supabase = await createClient()
  const { data: staff } = await supabase
    .from('staff_catalog')
    .select('id, full_name, photo_url, bio, location_text, live_arrangement, day_rate, month_rate, years_experience, verified_badge, trained_badge, background_checked_badge, rating_avg, rating_count, availability')
    .eq('agency_id', agency.id)
    .eq('category_id', category.id)
    .order('rating_avg', { ascending: false })

  return (
    <section className="bg-sparkle">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Link href="/services" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-brand-600">
          <ArrowLeft className="size-4" /> All services
        </Link>

        <Reveal className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
          <span className="grid size-20 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lift">
            <CategoryIcon name={category.icon} className="size-10" />
          </span>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-navy-800">{category.name}</h1>
            {category.description && <p className="mt-2 max-w-2xl text-lg text-navy-600">{category.description}</p>}
          </div>
        </Reveal>

        {staff && staff.length > 0 ? (
          <Stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {staff.map((s) => (
              <StaggerItem key={s.id}>
                <HoverLift className="h-full overflow-hidden rounded-3xl border border-brand-100 bg-white">
                  <div className="relative aspect-[4/3] bg-gradient-to-br from-brand-50 to-gold-100">
                    {s.photo_url ? (
                      <Image src={s.photo_url} alt={s.full_name ?? ''} fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover" />
                    ) : (
                      <UserRound className="absolute inset-0 m-auto size-20 text-brand-200" />
                    )}
                    {s.availability === 'available' && (
                      <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-emerald-700">Available</span>
                    )}
                  </div>
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="text-lg font-bold text-navy-800">{s.full_name}</h2>
                      {(s.rating_count ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-sm font-semibold text-navy-700">
                          <Star className="size-4 fill-gold-400 text-gold-500" /> {Number(s.rating_avg).toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-navy-500">
                      {s.location_text && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" />{s.location_text}</span>}
                      {s.live_arrangement && <span>{LIVE_LABEL[s.live_arrangement]}</span>}
                      {s.years_experience != null && <span>{s.years_experience} yrs exp.</span>}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {s.verified_badge && <Badge icon={<BadgeCheck className="size-3.5" />}>Verified</Badge>}
                      {s.trained_badge && <Badge icon={<GraduationCap className="size-3.5" />}>Trained</Badge>}
                      {s.background_checked_badge && <Badge icon={<ShieldCheck className="size-3.5" />}>Background-checked</Badge>}
                    </div>
                    {(s.month_rate || s.day_rate) && (
                      <p className="mt-4 text-sm text-navy-500">
                        From <span className="text-base font-bold text-navy-800">{formatKes(s.month_rate ?? s.day_rate)}</span> / {s.month_rate ? 'month' : 'day'}
                      </p>
                    )}
                  </div>
                </HoverLift>
              </StaggerItem>
            ))}
          </Stagger>
        ) : (
          <Reveal className="mt-12 rounded-[2rem] border border-dashed border-brand-200 bg-white/80 px-6 py-14 text-center">
            <p className="font-script text-3xl text-brand-500">Profiles coming soon</p>
            <p className="mx-auto mt-3 max-w-lg text-navy-600">
              We&apos;re adding vetted {category.name.toLowerCase()} profiles here. In the meantime, message us and we&apos;ll
              match you with someone suitable today.
            </p>
            <a
              href={whatsappLink(agency, `Hello ${agency.name}, I'm looking for a ${category.name}.`)}
              target="_blank"
              rel="noopener"
              className={buttonClass('whatsapp', 'lg', 'mt-7')}
            >
              <WhatsAppIcon className="size-5" /> Ask about a {category.name}
            </a>
          </Reveal>
        )}
      </div>
    </section>
  )
}

function Badge({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
      {icon} {children}
    </span>
  )
}
