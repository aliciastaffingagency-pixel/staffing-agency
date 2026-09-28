'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export type PortalLink = { href: string; label: string; count?: number }

// The portal root (e.g. /admin) is only active on itself; deeper links match their subtree.
function isActive(pathname: string, href: string, root: string) {
  if (href === root) return pathname === root
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function PortalNav({ links, label, variant }: { links: PortalLink[]; label: string; variant: 'desktop' | 'mobile' }) {
  const pathname = usePathname()
  const root = links[0]?.href ?? '/'

  return (
    <nav
      aria-label={label}
      className={cn(
        variant === 'desktop'
          ? 'hidden flex-wrap gap-1 lg:flex'
          : 'flex gap-1 overflow-x-auto border-t border-brand-50 px-4 py-2 [scrollbar-width:none] lg:hidden',
      )}
    >
      {links.map((l) => {
        const active = isActive(pathname, l.href, root)
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition',
              active ? 'bg-brand-500 text-white' : 'text-navy-600 hover:bg-brand-50 hover:text-brand-600',
            )}
          >
            {l.label}
            {l.count ? (
              <span className={cn('rounded-full px-1.5 text-[0.7rem] font-bold', active ? 'bg-white/25' : 'bg-brand-100 text-brand-700')}>
                {l.count}
              </span>
            ) : null}
          </Link>
        )
      })}
    </nav>
  )
}
