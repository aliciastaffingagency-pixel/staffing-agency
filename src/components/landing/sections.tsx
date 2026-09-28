import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight, BadgeCheck, CalendarCheck, Clock, CreditCard, FileSignature, HandCoins, HandHeart, Heart, Search,
  ShieldCheck, Star, Users,
} from 'lucide-react'
import { CategoryIcon } from '@/components/category-icon'
import { CountUp, HoverLift, Reveal, Stagger, StaggerItem } from '@/components/motion'
import { Crown } from '@/components/icons'
import type { AgencyStat } from '@/lib/agency'

export function SectionHeading({
  eyebrow,
  title,
  script,
  children,
  center = true,
}: {
  eyebrow: string
  title: string
  script?: string
  children?: React.ReactNode
  center?: boolean
}) {
  return (
    <Reveal className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-xl'}>
      <p className={`inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-brand-500 ${center ? 'justify-center' : ''}`}>
        <Crown className="w-5 text-gold-500" /> {eyebrow}
      </p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-navy-800 sm:text-[2.6rem] sm:leading-[1.1]">
        {title} {script && <span className="font-script text-[1.12em] text-brand-500">{script}</span>}
      </h2>
      {children && <p className="mt-4 text-lg leading-relaxed text-navy-600">{children}</p>}
    </Reveal>
  )
}

// The four promises from the flyer.
const VALUES = [
  { icon: HandHeart, title: 'Reliable & Honest', text: 'People you can trust in your home, around your family and your belongings.' },
  { icon: Users, title: 'Well-Trained Staff', text: 'Trained in housekeeping, childcare, cooking and safety before placement.' },
  { icon: Clock, title: 'On-Time Service', text: 'Fast matching and dependable replacements when you need them.' },
  { icon: HandCoins, title: 'Affordable Rates', text: 'Clear daily and monthly rates, agreed upfront in your contract.' },
]

export function ValuesStrip() {
  return (
    <section className="relative z-10 -mt-6 px-4 sm:px-6">
      <Stagger className="mx-auto grid max-w-6xl gap-px overflow-hidden rounded-3xl bg-brand-100 shadow-soft sm:grid-cols-2 lg:grid-cols-4">
        {VALUES.map((v) => (
          <StaggerItem key={v.title} className="bg-white p-6">
            <v.icon className="size-9 text-brand-500" strokeWidth={1.7} />
            <h3 className="mt-4 font-bold text-navy-800">{v.title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-navy-500">{v.text}</p>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  )
}

type CategoryCard = { id: string; name: string; slug: string; description: string | null; icon: string | null }

export function CategoryGrid({ categories }: { categories: CategoryCard[] }) {
  return (
    <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {categories.map((c) => (
        <StaggerItem key={c.id}>
          <HoverLift className="group h-full rounded-3xl border border-brand-100 bg-white">
            <Link href={`/services/${c.slug}`} className="flex h-full flex-col p-6">
              <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-50 to-gold-100 text-brand-500 transition-colors duration-300 group-hover:from-brand-500 group-hover:to-brand-600 group-hover:text-white">
                <CategoryIcon name={c.icon} className="size-7" />
              </span>
              <h3 className="mt-5 text-lg font-bold text-navy-800">{c.name}</h3>
              {c.description && <p className="mt-2 flex-1 text-sm leading-relaxed text-navy-500">{c.description}</p>}
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-500">
                View staff <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
            </Link>
          </HoverLift>
        </StaggerItem>
      ))}
    </Stagger>
  )
}

export function ServicesSection({ categories }: { categories: CategoryCard[] }) {
  return (
    <section id="services" className="mx-auto max-w-7xl scroll-mt-28 px-4 py-24 sm:px-6">
      <SectionHeading eyebrow="Our services" title="Every kind of help your" script="home needs">
        From daily house help to security for your business — pick a service to see available, vetted staff.
      </SectionHeading>
      <div className="mt-14">
        <CategoryGrid categories={categories} />
      </div>
    </section>
  )
}

const STEPS = [
  { icon: Search, title: 'Browse', text: 'Filter vetted staff by role, area, live-in or live-out, and budget.' },
  { icon: CalendarCheck, title: 'Request', text: 'Send a booking request — we confirm the best match for you.' },
  { icon: FileSignature, title: 'Sign', text: 'Review your digital contract: trial period, replacement policy, rates.' },
  { icon: CreditCard, title: 'Pay', text: 'Pay securely with M-Pesa or card. Your receipt is saved automatically.' },
  { icon: Star, title: 'Rate', text: 'Rate your staff and request a replacement anytime, right from your account.' },
]

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-28 bg-gradient-to-b from-blush to-cream py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading eyebrow="How it works" title="From search to signed contract," script="online">
          No more phone tag. Everything happens in your account, and we&apos;re one WhatsApp away if you need us.
        </SectionHeading>
        <Stagger className="relative mt-16 grid gap-8 md:grid-cols-5 md:gap-4" gap={0.12}>
          <div className="absolute left-[10%] right-[10%] top-8 hidden h-0.5 bg-[repeating-linear-gradient(90deg,var(--color-brand-300)_0_8px,transparent_8px_16px)] md:block" />
          {STEPS.map((s, i) => (
            <StaggerItem key={s.title} className="relative text-center">
              <span className="relative mx-auto grid size-16 place-items-center rounded-full border-4 border-cream bg-brand-500 text-white shadow-lift">
                <s.icon className="size-7" />
                <span className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-full bg-gold-500 text-xs font-bold text-navy-900">
                  {i + 1}
                </span>
              </span>
              <h3 className="mt-5 text-lg font-bold text-navy-800">{s.title}</h3>
              <p className="mx-auto mt-2 max-w-[15rem] text-sm leading-relaxed text-navy-500">{s.text}</p>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}

const TRUST = [
  { icon: BadgeCheck, title: 'Verified', text: 'National ID confirmed and personal details checked in person.' },
  { icon: ShieldCheck, title: 'Background-checked', text: 'References called and past employment confirmed before listing.' },
  { icon: Crown, title: 'Trained', text: 'Completed our training in home care, hygiene, childcare or safety.' },
]

export function WhyUs() {
  return (
    <section id="why-us" className="mx-auto grid max-w-7xl scroll-mt-28 items-center gap-16 px-4 py-24 sm:px-6 lg:grid-cols-2">
      <Reveal className="relative mx-auto grid w-full max-w-md grid-cols-2 gap-4">
        {[
          { src: '/brand/photo-cleaning.jpg', alt: 'Staff member making a bed with fresh linen', cls: 'translate-y-8' },
          { src: '/brand/photo-kitchen.jpg', alt: 'Staff member cleaning a kitchen counter', cls: '' },
          { src: '/brand/photo-cooking.jpg', alt: 'Staff member cooking a fresh meal', cls: 'col-span-2 mx-auto w-1/2 -mt-4' },
        ].map((p) => (
          <div key={p.src} className={`overflow-hidden rounded-full border-[5px] border-white shadow-lift ring-2 ring-gold-400 ${p.cls}`}>
            <Image src={p.src} alt={p.alt} width={204} height={204} className="aspect-square w-full object-cover" />
          </div>
        ))}
        <Heart className="absolute -left-2 top-1/2 size-8 fill-brand-300 text-brand-300" />
      </Reveal>

      <div>
        <SectionHeading eyebrow="Why families trust us" title="Know who's coming" script="into your home" center={false}>
          Every profile shows exactly which checks a person has passed. No guesswork, no newspaper-ad gamble.
        </SectionHeading>
        <Stagger className="mt-10 grid gap-4">
          {TRUST.map((t) => (
            <StaggerItem key={t.title}>
              <HoverLift className="flex gap-4 rounded-2xl border border-brand-100 bg-white p-5">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">
                  <t.icon className="size-6 w-7" />
                </span>
                <span>
                  <span className="flex items-center gap-2 font-bold text-navy-800">
                    {t.title}
                    <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-gold-700">badge</span>
                  </span>
                  <span className="mt-1 block text-sm leading-relaxed text-navy-500">{t.text}</span>
                </span>
              </HoverLift>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </section>
  )
}

export function StatsBand({ stats }: { stats: AgencyStat[] }) {
  if (!stats.length) return null
  return (
    <section className="bg-navy-800 py-16 text-white">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 text-center sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <CountUp to={s.value} suffix={s.suffix} className="text-5xl font-extrabold text-gold-300" />
            <p className="mt-2 text-sm text-white/70">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
