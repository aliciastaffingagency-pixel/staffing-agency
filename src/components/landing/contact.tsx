import { Mail, MapPin, Phone } from 'lucide-react'
import { ServiceAreaMap } from '@/components/map/service-area-map'
import { Reveal } from '@/components/motion'
import { ButtonLink, buttonClass } from '@/components/ui/button'
import { WhatsAppIcon } from '@/components/icons'
import { formatPhone, whatsappLink, type Agency } from '@/lib/agency'
import { SectionHeading } from './sections'

export function ContactSection({ agency }: { agency: Agency }) {
  const center = agency.settings.map_center ?? [-1.286389, 36.817223]

  return (
    <section id="contact" className="scroll-mt-28 bg-gradient-to-b from-cream to-blush py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionHeading eyebrow={agency.settings.service_area_label ?? 'Serving all areas'} title="Talk to us —" script="we're here" center={false}>
            Call or WhatsApp and we&apos;ll help you find the right person today. Prefer to browse first? Create a free
            account and book online.
          </SectionHeading>
          <Reveal delay={0.1} className="mt-8 grid gap-3">
            <a href={`tel:${agency.phone}`} className="flex items-center gap-4 rounded-2xl border border-brand-100 bg-white p-4 transition hover:border-brand-300">
              <span className="grid size-12 place-items-center rounded-full bg-brand-500 text-white"><Phone className="size-5" /></span>
              <span>
                <span className="block text-xs font-semibold uppercase tracking-wider text-navy-400">Call / WhatsApp</span>
                <span className="text-xl font-bold text-navy-800">{formatPhone(agency.phone)}</span>
              </span>
            </a>
            {agency.email && (
              <a href={`mailto:${agency.email}`} className="flex items-center gap-4 rounded-2xl border border-brand-100 bg-white p-4 transition hover:border-brand-300">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-navy-800 text-white"><Mail className="size-5" /></span>
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-wider text-navy-400">Email</span>
                  <span className="block truncate font-semibold text-navy-800">{agency.email}</span>
                </span>
              </a>
            )}
            <div className="mt-3 flex flex-wrap gap-3">
              <a href={whatsappLink(agency)} target="_blank" rel="noopener" className={buttonClass('whatsapp', 'lg')}>
                <WhatsAppIcon className="size-5" /> WhatsApp us
              </a>
              <ButtonLink href="/signup" variant="navy" size="lg">Create free account</ButtonLink>
            </div>
          </Reveal>
        </div>

        <Reveal delay={0.15} className="relative">
          <div className="h-[26rem] overflow-hidden rounded-[2rem] border-[6px] border-white shadow-lift">
            <ServiceAreaMap center={center} />
          </div>
          <div className="absolute -bottom-5 left-6 flex items-center gap-2 rounded-full bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white shadow-soft">
            <MapPin className="size-4 text-gold-300" /> {agency.settings.service_area_label ?? 'Serving all areas'}
          </div>
        </Reveal>
      </div>
    </section>
  )
}
