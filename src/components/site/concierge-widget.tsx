'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Loader2, MessageCircleHeart, SendHorizontal, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Turn = { role: 'user' | 'assistant'; content: string }

const STARTERS = ['How much does a nanny cost?', 'How do replacements work?', 'I’m looking for work', 'Please call me back']

// Turns "/staff"-style paths in replies into links.
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\/(?:staff|book|match|jobs(?:\/apply)?|services|signup)\b)/g)
  return (
    <>
      {parts.map((p, i) =>
        /^\/(staff|book|match|jobs|services|signup)/.test(p) ? (
          <Link key={i} href={p} className="font-semibold underline">
            {p}
          </Link>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  )
}

export function ConciergeWidget() {
  const [open, setOpen] = useState(false)
  const [turns, setTurns] = useState<Turn[]>([
    { role: 'assistant', content: 'Karibu! 👋 I’m the Alicia concierge. Ask me about our staff, prices, contracts or jobs, or leave your number for a callback.' },
  ])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [turns.length, busy])

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    const next = [...turns, { role: 'user' as const, content }]
    setTurns(next)
    setDraft('')
    setBusy(true)
    try {
      // The greeting isn't sent; the API expects the visitor to speak first.
      const res = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.slice(1).slice(-15) }),
      })
      const data = (await res.json()) as { reply?: string; error?: string }
      setTurns((t) => [...t, { role: 'assistant', content: data.reply ?? data.error ?? 'Sorry, something went wrong. Please WhatsApp us.' }])
    } catch {
      setTurns((t) => [...t, { role: 'assistant', content: 'Sorry, I couldn’t connect. Please try again or WhatsApp us.' }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {/* Bottom-left on phones so it doesn't stack over forms with the WhatsApp button. */}
      <motion.button
        type="button"
        onClick={() => setOpen((o) => !o)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 1.5, type: 'spring', stiffness: 260, damping: 18 }}
        whileHover={{ scale: 1.06 }}
        className="fixed bottom-5 left-5 z-50 grid size-14 place-items-center rounded-full bg-brand-500 text-white shadow-lift sm:bottom-23 sm:left-auto sm:right-5"
        aria-label={open ? 'Close chat' : 'Chat with our concierge'}
        aria-expanded={open}
      >
        {open ? <X className="size-6" /> : <MessageCircleHeart className="size-7" />}
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="Alicia concierge chat"
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-23 left-4 z-50 flex h-[min(34rem,calc(100dvh-8rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white shadow-soft sm:bottom-41 sm:left-auto sm:right-4 sm:h-[min(34rem,calc(100dvh-12rem))]"
          >
            <div className="bg-gradient-to-r from-brand-500 to-brand-600 px-5 py-4 text-white">
              <p className="font-script text-2xl leading-none">Alicia concierge</p>
              <p className="text-xs text-white/80">Usually answers instantly</p>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto bg-blush/40 p-4" aria-live="polite">
              {turns.map((t, i) => (
                <div key={i} className={cn('flex', t.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <p className={cn('max-w-[85%] whitespace-pre-line rounded-3xl px-4 py-2.5 text-sm', t.role === 'user' ? 'rounded-br-md bg-brand-500 text-white' : 'rounded-bl-md bg-white text-navy-800 shadow-sm')}>
                    {t.role === 'assistant' ? <Rich text={t.content} /> : t.content}
                  </p>
                </div>
              ))}
              {busy && (
                <p className="inline-flex items-center gap-2 rounded-3xl bg-white px-4 py-2.5 text-sm text-navy-400 shadow-sm">
                  <Loader2 className="size-4 animate-spin" /> Typing…
                </p>
              )}
              {turns.length === 1 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {STARTERS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs text-brand-700 hover:bg-brand-50">
                      {s}
                    </button>
                  ))}
                </div>
              )}
              <div ref={end} />
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void send(draft)
              }}
              className="flex gap-2 border-t border-brand-50 p-3"
            >
              <label htmlFor="concierge-input" className="sr-only">Your message</label>
              <input
                id="concierge-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                maxLength={1000}
                placeholder="Type your question…"
                className="h-11 flex-1 rounded-full border border-navy-100 px-4 text-sm outline-none focus:border-brand-400"
              />
              <button disabled={busy || !draft.trim()} className="grid size-11 place-items-center rounded-full bg-brand-500 text-white disabled:opacity-50" aria-label="Send">
                <SendHorizontal className="size-5" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
