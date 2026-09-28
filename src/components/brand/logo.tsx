import Link from 'next/link'
import { cn } from '@/lib/utils'

// Crown + house + heart mark, redrawn from the original flyer logo.
export function LogoMark({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={className}>
      <path d="M20 15 22 5l5 5 5-7 5 7 5-5 2 10Z" fill="#D4A43A" />
      <rect x="20" y="15" width="24" height="3.2" rx="1.2" fill="#B3862A" />
      <rect x="44" y="21" width="5.5" height="10" rx="1" fill="#D61F7A" />
      <path
        d="M8 35 32 17l24 18M14 31v26h36V31"
        fill="none"
        stroke={light ? '#FFFFFF' : '#1C1F4A'}
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M32 52c-9.5-6.4-10.6-15.6-4.4-16.4 2.1-.3 3.6 1.1 4.4 2.6.8-1.5 2.3-2.9 4.4-2.6 6.2.8 5.1 10-4.4 16.4Z"
        fill="#D61F7A"
      />
    </svg>
  )
}

export function Logo({ className, href = '/', light = false }: { className?: string; href?: string; light?: boolean }) {
  return (
    <Link href={href} className={cn('group inline-flex items-center gap-2.5', className)} aria-label="Alicia Staffing Agency — home">
      <LogoMark light={light} className="size-11 shrink-0 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105" />
      <span className="flex flex-col leading-none">
        <span className="font-script text-[1.9rem] leading-[0.9] text-brand-500">Alicia</span>
        <span className={cn('mt-1 text-[0.62rem] font-bold tracking-[0.28em]', light ? 'text-white/85' : 'text-navy-800')}>
          STAFFING AGENCY
        </span>
      </span>
    </Link>
  )
}
