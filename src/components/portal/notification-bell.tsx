'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDateTime } from '@/lib/utils'
import { markNotificationsRead } from './notification-actions'

export type BellNotification = { id: string; message: string; link: string | null; read: boolean; created_at: string }

export function NotificationBell({ initial }: { initial: BellNotification[] }) {
  // Server-loaded list + anything that arrived live since, minus what was just read here.
  const [live, setLive] = useState<BellNotification[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(() => new Set())
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const seen = new Set<string>()
  const items = [...live, ...initial]
    .filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)))
    .slice(0, 20)
    .map((n) => (readIds.has(n.id) ? { ...n, read: true } : n))
  const unread = items.filter((n) => !n.read).length

  // Live updates: RLS on realtime only delivers rows this user may read.
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
        setLive((prev) => [payload.new as BellNotification, ...prev].slice(0, 20))
        router.refresh()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [router])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const toggle = () => {
    setOpen((o) => !o)
    const ids = items.filter((n) => !n.read).map((n) => n.id)
    if (!open && ids.length) {
      setReadIds((prev) => new Set([...prev, ...ids]))
      void markNotificationsRead(ids)
    }
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={toggle}
        className="relative grid size-10 place-items-center rounded-full text-navy-500 hover:bg-brand-50 hover:text-brand-600"
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        aria-expanded={open}
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-brand-500 px-1 text-[0.65rem] font-bold text-white">{unread}</span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft"
          >
            <p className="border-b border-brand-50 px-5 py-3 text-sm font-bold text-navy-800">Notifications</p>
            {items.length ? (
              <ul className="max-h-96 overflow-y-auto">
                {items.map((n) => (
                  <li key={n.id} className="border-b border-brand-50 last:border-0">
                    <Link href={n.link ?? '#'} onClick={() => setOpen(false)} className={cn('block px-5 py-3 text-sm hover:bg-blush', !n.read && 'bg-brand-50/50')}>
                      <span className="block text-navy-700">{n.message}</span>
                      <span className="text-xs text-navy-400">{formatDateTime(n.created_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-8 text-center text-sm text-navy-400">You&apos;re all caught up.</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
