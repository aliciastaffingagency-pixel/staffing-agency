'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Loader2, SendHorizontal } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn, formatDateTime } from '@/lib/utils'
import { markThreadRead, sendMessage } from './actions'

export type ChatMessage = { id: string; body: string; sender_role: 'client' | 'super_admin' | 'staff'; created_at: string }

export function ChatThread({
  threadId,
  me,
  initial,
  otherName,
}: {
  threadId: string
  me: 'client' | 'super_admin'
  initial: ChatMessage[]
  otherName: string
}) {
  const [messages, setMessages] = useState(initial)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const end = useRef<HTMLDivElement>(null)

  const add = (m: ChatMessage) => setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m].sort((a, b) => a.created_at.localeCompare(b.created_at))))

  // Live messages from the other side (RLS limits realtime to this thread's participants).
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`thread-${threadId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${threadId}` }, (payload) => {
        add(payload.new as ChatMessage)
        void markThreadRead(threadId)
      })
      .subscribe()
    void markThreadRead(threadId)
    return () => {
      supabase.removeChannel(channel)
    }
  }, [threadId])

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages.length])

  const send = () => {
    const body = draft.trim()
    if (!body) return
    setError(null)
    startTransition(async () => {
      const res = await sendMessage(threadId, body)
      if (res.error) return setError(res.error)
      add({ id: res.id!, body, sender_role: me, created_at: res.created_at! })
      setDraft('')
    })
  }

  return (
    <div className="flex h-[min(70vh,40rem)] flex-col overflow-hidden rounded-3xl border border-brand-100 bg-white">
      <div className="flex-1 space-y-3 overflow-y-auto bg-blush/40 p-4 sm:p-6" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-navy-400">No messages yet. Say hello!</p>}
        {messages.map((m) => {
          const mine = m.sender_role === me
          return (
            <div key={m.id} className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[80%] rounded-3xl px-4 py-2.5 text-sm shadow-sm', mine ? 'rounded-br-md bg-brand-500 text-white' : 'rounded-bl-md bg-white text-navy-800')}>
                {!mine && <p className="mb-0.5 text-xs font-semibold text-brand-600">{otherName}</p>}
                <p className="whitespace-pre-line leading-relaxed">{m.body}</p>
                <p className={cn('mt-1 text-[0.65rem]', mine ? 'text-white/70' : 'text-navy-400')}>{formatDateTime(m.created_at)}</p>
              </div>
            </div>
          )
        })}
        <div ref={end} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        className="flex items-end gap-2 border-t border-brand-50 p-3"
      >
        <label className="sr-only" htmlFor={`msg-${threadId}`}>Message</label>
        <textarea
          id={`msg-${threadId}`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          rows={1}
          maxLength={5000}
          placeholder="Write a message…"
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-navy-100 px-4 py-2.5 text-sm outline-none focus:border-brand-400"
        />
        <button disabled={pending || !draft.trim()} className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50" aria-label="Send">
          {pending ? <Loader2 className="size-5 animate-spin" /> : <SendHorizontal className="size-5" />}
        </button>
      </form>
      {error && <p className="px-4 pb-3 text-xs font-medium text-red-600">{error}</p>}
    </div>
  )
}
