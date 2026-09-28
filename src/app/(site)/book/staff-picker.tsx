'use client'

import Image from 'next/image'
import { BadgeCheck, ExternalLink, GraduationCap, MapPin, ShieldCheck, Sparkles, Star, UserRound } from 'lucide-react'
import { cn, formatKes, LIVE_LABEL } from '@/lib/utils'

export type StaffOption = {
  id: string
  full_name: string
  photo_url: string | null
  location_text: string | null
  live_arrangement: keyof typeof LIVE_LABEL | null
  month_rate: number | null
  day_rate: number | null
  years_experience: number | null
  rating_avg: number | null
  rating_count: number | null
  verified_badge: boolean | null
  trained_badge: boolean | null
  background_checked_badge: boolean | null
  available: boolean
}

// Radio-card list of the people in the chosen service. "" = let the agency choose.
export function StaffPicker({
  options,
  value,
  onChange,
  categoryName,
}: {
  options: StaffOption[]
  value: string
  onChange: (id: string) => void
  categoryName: string
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className="mb-1 text-sm font-semibold text-navy-700">
        Choose who you&apos;d like{' '}
        <span className="font-normal text-navy-400">
          ({options.filter((o) => o.available).length} {categoryName.toLowerCase()} available now)
        </span>
      </legend>

      <label className={card(value === '')}>
        <input type="radio" name="staff_id" value="" checked={value === ''} onChange={() => onChange('')} className="sr-only" />
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
          <Sparkles className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-navy-800">Let the agency choose for me</span>
          <span className="block text-sm text-navy-500">We&apos;ll pick the best match for your needs and budget.</span>
        </span>
        <Dot on={value === ''} />
      </label>

      {options.length === 0 && (
        <p className="rounded-2xl border border-dashed border-brand-200 px-4 py-5 text-center text-sm text-navy-500">
          No {categoryName.toLowerCase()} profiles are listed yet. Send your request and we&apos;ll match you with someone suitable.
        </p>
      )}

      <div className="grid max-h-[28rem] gap-3 overflow-y-auto pr-1">
        {options.map((s) => {
          const rate = s.month_rate ?? s.day_rate
          return (
            <label key={s.id} className={card(value === s.id)}>
              <input type="radio" name="staff_id" value={s.id} checked={value === s.id} onChange={() => onChange(s.id)} className="sr-only" />
              <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand-50">
                {s.photo_url ? <Image src={s.photo_url} alt="" fill sizes="56px" className="object-cover" /> : <UserRound className="size-7 text-brand-200" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 font-bold text-navy-800">
                  {s.full_name}
                  {(s.rating_count ?? 0) > 0 && (
                    <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-navy-600">
                      <Star className="size-3.5 fill-gold-400 text-gold-500" /> {Number(s.rating_avg).toFixed(1)}
                    </span>
                  )}
                  {!s.available && <span className="rounded-full bg-navy-50 px-2 py-0.5 text-[0.65rem] font-semibold text-navy-500">Currently placed</span>}
                </span>
                <span className="flex flex-wrap gap-x-3 text-xs text-navy-500">
                  {s.location_text && (
                    <span className="inline-flex items-center gap-0.5">
                      <MapPin className="size-3" /> {s.location_text}
                    </span>
                  )}
                  {s.live_arrangement && <span>{LIVE_LABEL[s.live_arrangement]}</span>}
                  {s.years_experience != null && <span>{s.years_experience} yrs</span>}
                  {rate != null && (
                    <span className="font-semibold text-navy-700">
                      {formatKes(rate)}/{s.month_rate ? 'mo' : 'day'}
                    </span>
                  )}
                </span>
                <span className="mt-1 flex gap-1.5 text-brand-500">
                  {s.verified_badge && <BadgeCheck className="size-4" aria-label="Verified" />}
                  {s.background_checked_badge && <ShieldCheck className="size-4" aria-label="Background-checked" />}
                  {s.trained_badge && <GraduationCap className="size-4" aria-label="Trained" />}
                  <a
                    href={`/staff/${s.id}`}
                    target="_blank"
                    rel="noopener"
                    onClick={(e) => e.stopPropagation()}
                    className="ml-auto inline-flex items-center gap-0.5 text-xs font-semibold text-brand-600 hover:underline"
                  >
                    Profile <ExternalLink className="size-3" />
                  </a>
                </span>
              </span>
              <Dot on={value === s.id} />
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

const card = (on: boolean) =>
  cn(
    'flex cursor-pointer items-center gap-3 rounded-2xl border-2 p-3 transition has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-brand-100',
    on ? 'border-brand-500 bg-brand-50/60' : 'border-navy-100 bg-white hover:border-brand-200',
  )

function Dot({ on }: { on: boolean }) {
  return (
    <span className={cn('grid size-5 shrink-0 place-items-center rounded-full border-2', on ? 'border-brand-500 bg-brand-500' : 'border-navy-200')}>
      {on && <span className="size-2 rounded-full bg-white" />}
    </span>
  )
}
