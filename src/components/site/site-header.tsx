import { Phone } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { ButtonLink } from '@/components/ui/button'
import { WhatsAppIcon } from '@/components/icons'
import { formatPhone, getAgency, whatsappLink } from '@/lib/agency'
import { getSession, HOME_FOR_ROLE } from '@/lib/auth'
import { MobileMenu } from './mobile-menu'

export const NAV_LINKS = [
  { href: '/services', label: 'Services' },
  { href: '/staff', label: 'Find staff' },
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/#why-us', label: 'Why us' },
  { href: '/#contact', label: 'Contact' },
]

export async function SiteHeader() {
  const [agency, session] = await Promise.all([getAgency(), getSession()])
  const dashboardHref = session ? HOME_FOR_ROLE[session.role] : null

  return (
    <header className="sticky top-0 z-40">
      <div className="hidden bg-navy-800 text-white/85 sm:block">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-6 text-xs">
          <p>
            <span className="text-gold-300">Reliable</span> · Trustworthy · Professional
          </p>
          <div className="flex items-center gap-5">
            <a href={`tel:${agency.phone}`} className="inline-flex items-center gap-1.5 hover:text-white">
              <Phone className="size-3.5" /> {formatPhone(agency.phone)}
            </a>
            <a href={whatsappLink(agency)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 hover:text-white">
              <WhatsAppIcon className="size-3.5" /> WhatsApp us
            </a>
          </div>
        </div>
      </div>

      <div className="border-b border-brand-100/70 bg-cream/85 backdrop-blur-lg">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Logo />

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="rounded-full px-4 py-2 text-sm font-medium text-navy-700 transition hover:bg-brand-50 hover:text-brand-600">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            {dashboardHref ? (
              <ButtonLink href={dashboardHref} variant="navy" size="sm">My dashboard</ButtonLink>
            ) : (
              <>
                <ButtonLink href="/login" variant="ghost" size="sm">Log in</ButtonLink>
                <ButtonLink href="/signup" size="sm">Get started</ButtonLink>
              </>
            )}
          </div>

          <MobileMenu links={NAV_LINKS} dashboardHref={dashboardHref} phone={agency.phone ?? ''} whatsapp={whatsappLink(agency)} />
        </div>
      </div>
    </header>
  )
}
