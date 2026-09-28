import type { Metadata } from 'next'
import { cache } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Briefcase, Home, Languages, MapPin, PlayCircle, Star, UserRound } from 'lucide-react'
import { Reveal } from '@/components/motion'
import { StaffBadges } from '@/components/staff/staff-card'
import { buttonClass } from '@/components/ui/button'
import { WhatsAppIcon } from '@/components/icons'
import { getAgency, whatsappLink } from '@/lib/agency'
import { createPublicClient } from '@/lib/supabase/public'
import { AVAILABILITY_LABEL, formatDate, formatKes, LIVE_LABEL } from '@/lib/utils'
import { StaffCta } from './staff-cta'

// Public page: served from the CDN, refreshed every 5 minutes and immediately after admin changes.
export const revalidate = 300

// No pages are built ahead of time; each one is rendered on its first visit and then cached (ISR).
export async function generateStaticParams() {
  return []
}

const getStaff = cache(async (id: string) => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const agency = await getAgency()
  const supabase = createPublicClient()
  const { data } = await supabase.from('staff_catalog').select('*').eq('id', id).eq('agency_id', agency.id).maybeSingle()
  return data
})

export async function generateMetadata({ params }: PageProps<'/staff/[id]'>): Promise<Metadata> {
  const s = await getStaff((await params).id)
  if (!s) return {}
  const first = s.full_name?.split(' ')[0]
  return {
    title: `${first}, ${s.category_name}`,
    description: s.bio?.slice(0, 160) ?? `${first} is a vetted ${s.category_name?.toLowerCase()} with Alicia Staffing Agency.`,
    openGraph: s.photo_url ? { images: [s.photo_url] } : undefined,
  }
}

function VideoIntro({ url }: { url: string }) {
  const yt = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)
  if (yt) {
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${yt[1]}`}
        title="Video introduction"
        className="aspect-video w-full rounded-3xl"
        allow="accelerometer; encrypted-media; picture-in-picture"
        allowFullScreen
      />
    )
  }
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
    return <video src={url} controls preload="metadata" className="aspect-video w-full rounded-3xl bg-navy-900" />
  }
  return (
    <a href={url} target="_blank" rel="noopener" className="inline-flex items-center gap-2 font-semibold text-brand-600 hover:underline">
      <PlayCircle className="size-5" /> Watch video introduction
    </a>
  )
}

export default async function StaffProfilePage({ params }: PageProps<'/staff/[id]'>) {
  const { id } = await params
  const [agency, s] = await Promise.all([getAgency(), getStaff(id)])
  if (!s || !s.id) notFound()

  const supabase = createPublicClient()
  const { data: reviews } = await supabase
    .from('staff_reviews')
    .select('id, stars, comment, client_first_name, client_area, created_at')
    .eq('staff_id', s.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const first = s.full_name?.split(' ')[0] ?? 'this person'
  const rating = Number(s.rating_avg ?? 0)

  return (
    <section className="bg-sparkle">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <Link href={s.category_slug ? `/services/${s.category_slug}` : '/staff'} className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-brand-600">
          <ArrowLeft className="size-4" /> {s.category_name ?? 'All staff'}
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[380px_1fr]">
          <Reveal className="lg:sticky lg:top-32 lg:self-start">
            <div className="overflow-hidden rounded-[2rem] border border-brand-100 bg-white shadow-soft">
              <div className="relative aspect-square bg-gradient-to-br from-brand-50 to-gold-100">
                {s.photo_url ? (
                  <Image src={s.photo_url} alt={s.full_name ?? ''} fill priority sizes="(min-width:1024px) 380px, 100vw" className="object-cover" />
                ) : (
                  <UserRound className="absolute inset-0 m-auto size-28 text-brand-200" />
                )}
              </div>
              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand-500">{s.category_name}</p>
                <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-navy-800">{s.full_name}</h1>
                {(s.rating_count ?? 0) > 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-navy-600">
                    <span className="flex">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star key={i} className={`size-4 ${i <= Math.round(rating) ? 'fill-gold-400 text-gold-500' : 'text-navy-200'}`} />
                      ))}
                    </span>
                    <strong>{rating.toFixed(1)}</strong> · {s.rating_count} review{s.rating_count === 1 ? '' : 's'}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-1.5">
                  <StaffBadges s={s} size="md" />
                </div>
                {(s.month_rate || s.day_rate) && (
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {s.month_rate && <Rate label="Monthly" value={formatKes(s.month_rate)!} />}
                    {s.day_rate && <Rate label="Daily" value={formatKes(s.day_rate)!} />}
                  </div>
                )}
                <div className="mt-6 grid gap-2">
                  <StaffCta staffId={s.id} firstName={first} available={s.availability === 'available'} />
                  <a
                    href={whatsappLink(agency, `Hello ${agency.name}, I'm interested in ${s.full_name} (${s.category_name}).`)}
                    target="_blank"
                    rel="noopener"
                    className={buttonClass('whatsapp', 'md', 'w-full')}
                  >
                    <WhatsAppIcon className="size-5" /> Ask about {first}
                  </a>
                </div>
              </div>
            </div>
          </Reveal>

          <div className="grid gap-6">
            <Reveal delay={0.05} className="rounded-[2rem] border border-brand-100 bg-white p-7">
              <ul className="grid gap-4 text-sm sm:grid-cols-2">
                <Fact icon={MapPin} label="Area">{s.location_text ?? 'Nairobi'}</Fact>
                <Fact icon={Home} label="Arrangement">{s.live_arrangement ? LIVE_LABEL[s.live_arrangement] : '—'}</Fact>
                <Fact icon={Briefcase} label="Experience">{s.years_experience != null ? `${s.years_experience} years` : '—'}</Fact>
                <Fact icon={Languages} label="Languages">{s.languages?.length ? s.languages.join(', ') : '—'}</Fact>
              </ul>
              <p className={`mt-5 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${s.availability === 'available' ? 'bg-emerald-50 text-emerald-700' : 'bg-navy-50 text-navy-500'}`}>
                {s.availability ? AVAILABILITY_LABEL[s.availability] : ''}
              </p>
              {s.bio && (
                <>
                  <h2 className="mt-6 text-lg font-bold text-navy-800">About {first}</h2>
                  <p className="mt-2 whitespace-pre-line leading-relaxed text-navy-600">{s.bio}</p>
                </>
              )}
              {s.skills && s.skills.length > 0 && (
                <>
                  <h2 className="mt-6 text-lg font-bold text-navy-800">Skills</h2>
                  <ul className="mt-3 flex flex-wrap gap-2">
                    {s.skills.map((sk) => (
                      <li key={sk} className="rounded-full border border-brand-100 bg-blush px-3 py-1 text-sm text-navy-700">{sk}</li>
                    ))}
                  </ul>
                </>
              )}
            </Reveal>

            {s.video_url && (
              <Reveal delay={0.1} className="rounded-[2rem] border border-brand-100 bg-white p-7">
                <h2 className="mb-4 text-lg font-bold text-navy-800">Say hello to {first}</h2>
                <VideoIntro url={s.video_url} />
              </Reveal>
            )}

            <Reveal delay={0.15} className="rounded-[2rem] border border-brand-100 bg-white p-7">
              <h2 className="text-lg font-bold text-navy-800">What clients say</h2>
              {reviews?.length ? (
                <ul className="mt-4 grid gap-4">
                  {reviews.map((r) => (
                    <li key={r.id} className="rounded-2xl bg-blush p-5">
                      <div className="flex items-center justify-between gap-3">
                        <span className="flex">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star key={i} className={`size-4 ${i <= (r.stars ?? 0) ? 'fill-gold-400 text-gold-500' : 'text-navy-200'}`} />
                          ))}
                        </span>
                        <time className="text-xs text-navy-400">{formatDate(r.created_at, { month: 'short', year: 'numeric' })}</time>
                      </div>
                      {r.comment && <p className="mt-2 leading-relaxed text-navy-700">“{r.comment}”</p>}
                      <p className="mt-2 text-sm font-semibold text-navy-600">
                        {r.client_first_name}
                        {r.client_area && <span className="font-normal text-navy-400"> · {r.client_area}</span>}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-navy-500">No reviews yet. Clients can rate {first} after a placement.</p>
              )}
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  )
}

function Rate({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-blush px-4 py-3">
      <p className="text-xs text-navy-500">{label}</p>
      <p className="text-lg font-extrabold text-navy-800">{value}</p>
    </div>
  )
}

function Fact({ icon: Icon, label, children }: { icon: typeof MapPin; label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">
        <Icon className="size-5" />
      </span>
      <span>
        <span className="block text-xs text-navy-400">{label}</span>
        <span className="font-semibold text-navy-800">{children}</span>
      </span>
    </li>
  )
}
