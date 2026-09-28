'use client'

import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from 'motion/react'
import { useEffect, useRef, type ComponentProps } from 'react'

const ease = [0.22, 1, 0.36, 1] as const

export function Reveal({
  delay = 0,
  y = 24,
  className,
  children,
}: {
  delay?: number
  y?: number
  className?: string
  children: React.ReactNode
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.7, ease, delay }}
    >
      {children}
    </motion.div>
  )
}

export function Stagger({ className, children, gap = 0.07 }: { className?: string; children: React.ReactNode; gap?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ className, children }: { className?: string; children: React.ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduce ? { opacity: 1 } : { opacity: 0, y: 22, scale: 0.98 },
        show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.55, ease } },
      }}
    >
      {children}
    </motion.div>
  )
}

// Card that lifts with a soft pink shadow on hover.
export function HoverLift({ className, children, ...rest }: ComponentProps<typeof motion.div>) {
  return (
    <motion.div
      className={className}
      whileHover={{ y: -6, boxShadow: '0 22px 45px -18px rgb(214 31 122 / 0.35)' }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

export function CountUp({ to, suffix = '', className }: { to: number; suffix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const value = useMotionValue(0)
  const rounded = useTransform(value, (v) => `${Math.round(v).toLocaleString('en-KE')}${suffix}`)

  useEffect(() => {
    if (!inView) return
    const controls = animate(value, to, { duration: 1.8, ease })
    return () => controls.stop()
  }, [inView, to, value])

  return <motion.span ref={ref} className={className}>{rounded}</motion.span>
}

export function Float({ className, children, delay = 0 }: { className?: string; children: React.ReactNode; delay?: number }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      animate={reduce ? undefined : { y: [0, -8, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay }}
    >
      {children}
    </motion.div>
  )
}
