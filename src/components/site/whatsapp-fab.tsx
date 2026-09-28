'use client'

import { motion } from 'motion/react'
import { WhatsAppIcon } from '@/components/icons'

export function WhatsAppFab({ href }: { href: string }) {
  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener"
      aria-label="Chat with us on WhatsApp"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 1.2, type: 'spring', stiffness: 260, damping: 18 }}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      className="fixed bottom-5 right-5 z-50 grid size-14 place-items-center rounded-full bg-[#25D366] text-white shadow-[0_12px_30px_-8px_rgb(37_211_102/0.8)]"
    >
      <span className="absolute inset-0 animate-ping rounded-full bg-[#25D366] opacity-25" />
      <WhatsAppIcon className="relative size-7" />
    </motion.a>
  )
}
