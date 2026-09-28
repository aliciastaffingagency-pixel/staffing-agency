'use client'

import { useActionState, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Loader2, Sparkles, Wand2 } from 'lucide-react'
import { StaffCard } from '@/components/staff/staff-card'
import { ButtonLink } from '@/components/ui/button'
import { FormAlert } from '@/components/ui/form'
import { findMatches, type MatchState } from './actions'

const EXAMPLES = [
  'Someone to cook and help with two toddlers, live-in, Kilimani, around 15,000',
  'A reliable driver for school runs in Karen, live-out',
  'Caregiver for my elderly mother in Lavington who speaks Kikuyu',
  'Night security guard for a shop in Westlands',
]

export function MatchFinder() {
  const [state, action, pending] = useActionState<MatchState, FormData>(findMatches, {})
  const [query, setQuery] = useState('')

  return (
    <div className="grid gap-10">
      <form action={action} className="rounded-[2rem] border border-brand-100 bg-white p-5 shadow-soft sm:p-7">
        <label htmlFor="match-query" className="text-sm font-semibold text-navy-700">
          Describe who you need, in your own words
        </label>
        <textarea
          id="match-query"
          name="query"
          required
          minLength={8}
          maxLength={800}
          rows={3}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g. A patient nanny for a 2-year-old, live-out, in South B, weekdays…"
          className="mt-2 block w-full resize-none rounded-2xl border border-navy-100 px-4 py-3 text-navy-800 outline-none focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {EXAMPLES.map((e) => (
            <button key={e} type="button" onClick={() => setQuery(e)} className="rounded-full bg-blush px-3 py-1.5 text-left text-xs text-navy-600 hover:bg-brand-50 hover:text-brand-700">
              {e}
            </button>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button disabled={pending} className="inline-flex h-12 items-center gap-2 rounded-full bg-brand-500 px-6 font-semibold text-white shadow-lift hover:bg-brand-600 disabled:opacity-60">
            {pending ? <Loader2 className="size-5 animate-spin" /> : <Wand2 className="size-5" />}
            {pending ? 'Finding your matches…' : 'Find my matches'}
          </button>
          <span className="text-xs text-navy-400">Free, no account needed.</span>
        </div>
        {state.error && (
          <div className="mt-4">
            <FormAlert error={state.error} />
          </div>
        )}
      </form>

      <AnimatePresence mode="wait">
        {state.result && !pending && (
          <motion.section key={state.query} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} aria-live="polite">
            <p className="flex items-start gap-2 text-lg text-navy-700">
              <Sparkles className="mt-1 size-5 shrink-0 text-gold-500" />
              {state.result.summary}
            </p>
            {state.result.follow_up && <p className="mt-2 text-sm text-navy-500">{state.result.follow_up}</p>}
            {state.result.matches.length > 0 ? (
              <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {state.result.matches.map((m, i) => (
                  <li key={m.staff.id} className="flex flex-col gap-3">
                    <p className="flex items-start gap-2 text-sm text-navy-600">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-gold-500 text-xs font-bold text-navy-900">{i + 1}</span>
                      {m.reason}
                    </p>
                    <StaffCard s={m.staff} showCategory />
                    <ButtonLink href={`/book?staff=${m.staff.id}`} size="sm" className="self-start">
                      Request {m.staff.full_name?.split(' ')[0]}
                    </ButtonLink>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="mt-6">
                <ButtonLink href="/book">Send a request, we&apos;ll recruit for you</ButtonLink>
              </div>
            )}
            <p className="mt-6 text-xs text-navy-400">
              {state.result.engine === 'ai' ? 'Matched by our AI assistant from live availability.' : 'Matched from live availability by role, area, arrangement and budget.'}
            </p>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  )
}
