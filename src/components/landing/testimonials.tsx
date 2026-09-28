'use client'

import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react'
import { useEffect, useState } from 'react'

export type Testimonial = {
  id: string
  stars: number
  comment: string
  client_first_name: string
  client_area: string | null
  category_name: string
}

export function TestimonialCarousel({ items }: { items: Testimonial[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const count = items.length

  useEffect(() => {
    if (paused || count < 2) return
    const id = setInterval(() => setIndex((i) => (i + 1) % count), 6000)
    return () => clearInterval(id)
  }, [paused, count])

  const t = items[index]
  const go = (d: number) => setIndex((i) => (i + d + count) % count)

  return (
    <div
      className="relative mx-auto max-w-3xl"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <Quote className="absolute -top-6 left-2 size-16 text-brand-100" aria-hidden="true" />
      <div className="relative min-h-60 rounded-[2rem] border border-brand-100 bg-white px-8 py-10 text-center shadow-soft sm:px-14">
        <AnimatePresence mode="wait">
          <motion.figure
            key={t.id}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.4 }}
            aria-live="polite"
          >
            <div className="flex justify-center gap-1" aria-label={`${t.stars} out of 5 stars`}>
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} className={`size-5 ${i < t.stars ? 'fill-gold-400 text-gold-500' : 'text-navy-100'}`} />
              ))}
            </div>
            <blockquote className="mt-5 text-lg leading-relaxed text-navy-700">“{t.comment}”</blockquote>
            <figcaption className="mt-6 text-sm">
              <span className="font-bold text-navy-800">{t.client_first_name}</span>
              {t.client_area && <span className="text-navy-400"> · {t.client_area}</span>}
              <span className="mt-1 block text-brand-500">{t.category_name}</span>
            </figcaption>
          </motion.figure>
        </AnimatePresence>
      </div>

      {count > 1 && (
        <div className="mt-6 flex items-center justify-center gap-4">
          <button type="button" onClick={() => go(-1)} className="grid size-10 place-items-center rounded-full border border-brand-200 bg-white text-navy-700 hover:bg-brand-50" aria-label="Previous review">
            <ChevronLeft className="size-5" />
          </button>
          <div className="flex gap-2">
            {items.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all ${i === index ? 'w-7 bg-brand-500' : 'w-2 bg-brand-200'}`}
                aria-label={`Show review ${i + 1}`}
              />
            ))}
          </div>
          <button type="button" onClick={() => go(1)} className="grid size-10 place-items-center rounded-full border border-brand-200 bg-white text-navy-700 hover:bg-brand-50" aria-label="Next review">
            <ChevronRight className="size-5" />
          </button>
        </div>
      )}
    </div>
  )
}
