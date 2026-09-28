'use client'

import { AnimatePresence, motion } from 'motion/react'
import { Menu, Phone, X } from 'lucide-react'
import { useState } from 'react'
import { ButtonLink, buttonClass } from '@/components/ui/button'
import { WhatsAppIcon } from '@/components/icons'

export function MobileMenu({
  links,
  dashboardHref,
  phone,
  whatsapp,
}: {
  links: { href: string; label: string }[]
  dashboardHref: string | null
  phone: string
  whatsapp: string
}) {
  const [open, setOpen] = useState(false)
  const close = () => setOpen(false)

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="grid size-11 place-items-center rounded-full text-navy-800 hover:bg-brand-50"
        aria-expanded={open}
        aria-label={open ? 'Close menu' : 'Open menu'}
      >
        {open ? <X className="size-6" /> : <Menu className="size-6" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-x-0 top-full border-b border-brand-100 bg-cream px-4 pb-6 pt-2 shadow-soft"
          >
            <nav className="flex flex-col" aria-label="Mobile">
              {links.map((l) => (
                <a key={l.href} href={l.href} onClick={close} className="rounded-xl px-3 py-3 font-medium text-navy-800 hover:bg-brand-50">
                  {l.label}
                </a>
              ))}
            </nav>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a href={`tel:${phone}`} className={buttonClass('outline', 'md')}>
                <Phone className="size-4" /> Call
              </a>
              <a href={whatsapp} target="_blank" rel="noopener" className={buttonClass('whatsapp', 'md')}>
                <WhatsAppIcon className="size-4" /> WhatsApp
              </a>
              {dashboardHref ? (
                <ButtonLink href={dashboardHref} variant="navy" className="col-span-2" onClick={close}>My dashboard</ButtonLink>
              ) : (
                <>
                  <ButtonLink href="/login" variant="outline" onClick={close}>Log in</ButtonLink>
                  <ButtonLink href="/signup" onClick={close}>Get started</ButtonLink>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
