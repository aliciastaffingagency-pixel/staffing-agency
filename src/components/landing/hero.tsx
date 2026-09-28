'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'motion/react'
import { BadgeCheck, GraduationCap, Heart, ShieldCheck, Star } from 'lucide-react'
import { ButtonLink, buttonClass } from '@/components/ui/button'
import { Crown, WhatsAppIcon } from '@/components/icons'
import { Float } from '@/components/motion'

const ease = [0.22, 1, 0.36, 1] as const

export function Hero({ tagline, whatsapp, categoryCount }: { tagline: string; whatsapp: string; categoryCount: number }) {
  const reduce = useReducedMotion()
  const rise = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 28 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.8, ease, delay },
  })

  return (
    <section className="relative overflow-hidden bg-sparkle">
      <div className="pointer-events-none absolute -left-40 -top-32 size-[34rem] rounded-full bg-brand-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-40 size-[26rem] rounded-full bg-gold-200/50 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-12 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:pb-28 lg:pt-20">
        <div>
          <motion.p
            {...rise(0)}
            className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-4 py-1.5 text-sm font-medium text-brand-600 shadow-soft"
          >
            <Heart className="size-4 fill-brand-500 text-brand-500" /> {tagline}
          </motion.p>

          <motion.h1
            {...rise(0.08)}
            className="mt-6 text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-navy-800 sm:text-6xl lg:text-[4.1rem]"
          >
            Trusted staff for your{' '}
            <span className="relative inline-block">
              <Crown className="absolute -top-1 left-[0.05em] w-[0.5em] -rotate-12 text-gold-500 drop-shadow-sm" />
              <span className="font-script text-[1.15em] font-bold text-gradient-brand">home</span>
            </span>{' '}
            &amp; business
          </motion.h1>

          <motion.p {...rise(0.16)} className="mt-6 max-w-xl text-lg leading-relaxed text-navy-600">
            House helps, nannies, caregivers, chefs, drivers, gardeners, security and more — vetted, trained and ready to
            serve. Browse profiles, book, sign and pay online, all in one place.
          </motion.p>

          <motion.div {...rise(0.24)} className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href="/services" size="lg">Browse our staff</ButtonLink>
            <a href={whatsapp} target="_blank" rel="noopener" className={buttonClass('whatsapp', 'lg')}>
              <WhatsAppIcon className="size-5" /> Chat on WhatsApp
            </a>
          </motion.div>

          <motion.ul {...rise(0.32)} className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm font-medium text-navy-700">
            <li className="inline-flex items-center gap-2"><GraduationCap className="size-5 text-brand-500" /> Trained</li>
            <li className="inline-flex items-center gap-2"><BadgeCheck className="size-5 text-brand-500" /> Verified</li>
            <li className="inline-flex items-center gap-2"><ShieldCheck className="size-5 text-brand-500" /> Background-checked</li>
            <li className="inline-flex items-center gap-2"><Star className="size-5 fill-gold-400 text-gold-500" /> {categoryCount}+ services</li>
          </motion.ul>
        </div>

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease, delay: 0.1 }}
          className="relative mx-auto w-full max-w-[26rem] lg:max-w-[28rem]"
        >
          <div className="absolute inset-0 translate-x-4 translate-y-4 rounded-t-[14rem] rounded-b-[2.5rem] bg-gradient-to-br from-gold-300 to-brand-300" />
          <div className="relative overflow-hidden rounded-t-[14rem] rounded-b-[2.5rem] border-[6px] border-white bg-gold-100 shadow-lift">
            <Image
              src="/brand/photo-hero.jpg"
              alt="Smiling Alicia staff member in a navy apron, ready to help around the home"
              width={470}
              height={900}
              priority
              className="aspect-[4/5.4] w-full object-cover object-top"
            />
          </div>

          <Float className="absolute -left-6 top-16 sm:-left-14" delay={0.4}>
            <div className="flex items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 shadow-soft backdrop-blur">
              <span className="grid size-10 place-items-center rounded-full bg-brand-50"><ShieldCheck className="size-5 text-brand-500" /></span>
              <span className="text-sm leading-tight">
                <span className="block font-semibold text-navy-800">ID &amp; references</span>
                <span className="text-navy-500">checked before listing</span>
              </span>
            </div>
          </Float>

          <Float className="absolute -right-4 bottom-24 sm:-right-10" delay={1.2}>
            <div className="grid size-32 place-items-center rounded-full bg-gradient-to-br from-gold-300 via-gold-400 to-gold-600 p-1.5 shadow-lift">
              <div className="grid size-full place-items-center rounded-full border-2 border-dashed border-white/70 text-center text-[0.72rem] font-bold leading-tight text-navy-900">
                <span>
                  <Crown className="mx-auto mb-1 w-6 text-navy-900" />
                  Trained<br />Verified<br />Trusted &amp; Ready<br />to Serve
                </span>
              </div>
            </div>
          </Float>
        </motion.div>
      </div>
    </section>
  )
}
