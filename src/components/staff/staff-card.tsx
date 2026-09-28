import Image from 'next/image'
import Link from 'next/link'
import { BadgeCheck, GraduationCap, MapPin, ShieldCheck, Star, UserRound } from 'lucide-react'
import { HoverLift } from '@/components/motion'
import type { Views } from '@/lib/supabase/database.types'
import { formatKes, LIVE_LABEL } from '@/lib/utils'

export const STAFF_CARD_COLUMNS =
  'id, full_name, photo_url, category_name, location_text, live_arrangement, day_rate, month_rate, years_experience, verified_badge, trained_badge, background_checked_badge, rating_avg, rating_count, availability' as const

export type StaffCardData = Pick<
  Views<'staff_catalog'>,
  | 'id' | 'full_name' | 'photo_url' | 'category_name' | 'location_text' | 'live_arrangement' | 'day_rate' | 'month_rate'
  | 'years_experience' | 'verified_badge' | 'trained_badge' | 'background_checked_badge' | 'rating_avg' | 'rating_count' | 'availability'
>

export function TrustBadge({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
      {icon} {children}
    </span>
  )
}

export function StaffBadges({ s, size = 'sm' }: { s: Pick<StaffCardData, 'verified_badge' | 'trained_badge' | 'background_checked_badge'>; size?: 'sm' | 'md' }) {
  const cls = size === 'sm' ? 'size-3.5' : 'size-4'
  return (
    <>
      {s.verified_badge && <TrustBadge icon={<BadgeCheck className={cls} />}>Verified</TrustBadge>}
      {s.trained_badge && <TrustBadge icon={<GraduationCap className={cls} />}>Trained</TrustBadge>}
      {s.background_checked_badge && <TrustBadge icon={<ShieldCheck className={cls} />}>Background-checked</TrustBadge>}
    </>
  )
}

export function StaffCard({ s, showCategory = false }: { s: StaffCardData; showCategory?: boolean }) {
  return (
    <HoverLift className="h-full overflow-hidden rounded-3xl border border-brand-100 bg-white">
      <Link href={`/staff/${s.id}`} className="flex h-full flex-col">
        <div className="relative aspect-[4/3] bg-gradient-to-br from-brand-50 to-gold-100">
          {s.photo_url ? (
            <Image src={s.photo_url} alt={s.full_name ?? ''} fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover" />
          ) : (
            <UserRound className="absolute inset-0 m-auto size-20 text-brand-200" />
          )}
          {s.availability === 'available' && (
            <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-emerald-700">Available</span>
          )}
          {showCategory && s.category_name && (
            <span className="absolute bottom-3 left-3 rounded-full bg-navy-800/85 px-3 py-1 text-xs font-semibold text-white">{s.category_name}</span>
          )}
        </div>
        <div className="flex flex-1 flex-col p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-bold text-navy-800">{s.full_name}</h3>
            {(s.rating_count ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-navy-700">
                <Star className="size-4 fill-gold-400 text-gold-500" /> {Number(s.rating_avg).toFixed(1)}
                <span className="font-normal text-navy-400">({s.rating_count})</span>
              </span>
            )}
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-navy-500">
            {s.location_text && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" />
                {s.location_text}
              </span>
            )}
            {s.live_arrangement && <span>{LIVE_LABEL[s.live_arrangement]}</span>}
            {s.years_experience != null && <span>{s.years_experience} yrs exp.</span>}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <StaffBadges s={s} />
          </div>
          {(s.month_rate || s.day_rate) && (
            <p className="mt-auto pt-4 text-sm text-navy-500">
              From <span className="text-base font-bold text-navy-800">{formatKes(s.month_rate ?? s.day_rate)}</span> / {s.month_rate ? 'month' : 'day'}
            </p>
          )}
        </div>
      </Link>
    </HoverLift>
  )
}
