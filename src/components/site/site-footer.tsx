import Link from 'next/link'
import { Mail, MapPin, Phone } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { WhatsAppIcon } from '@/components/icons'
import { LEGAL_LINKS } from '@/components/legal/legal-page'
import { formatPhone, getAgency, getCategories, whatsappLink } from '@/lib/agency'

export async function SiteFooter() {
  const [agency, categories] = await Promise.all([getAgency(), getCategories()])

  return (
    <footer className="relative overflow-hidden bg-navy-900 text-white/75">
      <div className="pointer-events-none absolute -top-40 right-0 size-[28rem] rounded-full bg-brand-500/15 blur-3xl" />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-5 max-w-sm text-sm leading-relaxed">
            {agency.tagline}. Vetted, trained and trusted staff for homes and businesses — browse, book, sign and pay online.
          </p>
          <p className="mt-4 font-script text-2xl text-brand-300">We make your home stress-free</p>
        </div>

        <div>
          <h2 className="text-sm font-semibold tracking-wide text-white">Our services</h2>
          <ul className="mt-4 grid gap-2 text-sm">
            {categories.slice(0, 8).map((c) => (
              <li key={c.id}>
                <Link href={`/services/${c.slug}`} className="transition hover:text-brand-300">{c.name}</Link>
              </li>
            ))}
            {categories.length > 8 && (
              <li><Link href="/services" className="text-gold-300 hover:text-gold-200">All services →</Link></li>
            )}
          </ul>
        </div>

        <div>
          <h2 className="text-sm font-semibold tracking-wide text-white">Get in touch</h2>
          <ul className="mt-4 grid gap-3 text-sm">
            <li>
              <a href={`tel:${agency.phone}`} className="inline-flex items-center gap-2 hover:text-white">
                <Phone className="size-4 text-brand-300" /> {formatPhone(agency.phone)}
              </a>
            </li>
            <li>
              <a href={whatsappLink(agency)} target="_blank" rel="noopener" className="inline-flex items-center gap-2 hover:text-white">
                <WhatsAppIcon className="size-4 text-[#25D366]" /> WhatsApp us
              </a>
            </li>
            {agency.email && (
              <li>
                <a href={`mailto:${agency.email}`} className="inline-flex items-center gap-2 break-all hover:text-white">
                  <Mail className="size-4 shrink-0 text-brand-300" /> {agency.email}
                </a>
              </li>
            )}
            <li className="inline-flex items-center gap-2">
              <MapPin className="size-4 text-brand-300" /> {agency.settings.service_area_label ?? 'Serving all areas'}
            </li>
          </ul>
        </div>
      </div>
      <div className="relative border-t border-white/10">
        <div className="mx-auto grid max-w-7xl gap-3 px-6 py-5 text-xs text-white/50">
          <nav aria-label="Legal" className="flex flex-wrap justify-center gap-x-5 gap-y-2 sm:justify-start">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="hover:text-white">
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <p>
              © {new Date().getFullYear()} {agency.name}. All rights reserved.
              {agency.settings.address && <> · {agency.settings.address}</>}
            </p>
            <p>Trained · Verified · Trusted &amp; Ready to Serve</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
