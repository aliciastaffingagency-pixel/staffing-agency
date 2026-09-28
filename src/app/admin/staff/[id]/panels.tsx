'use client'

import { useActionState, useState } from 'react'
import { Check, Circle, X } from 'lucide-react'
import { Field, FormAlert, SubmitButton, type FormState } from '@/components/ui/form'
import { cn } from '@/lib/utils'
import { grantStaffLogin, saveVettingCheck } from '../actions'

type CheckState = 'passed' | 'failed' | 'clear'

const STATE_UI: Record<CheckState, { icon: typeof Check; cls: string; label: string }> = {
  passed: { icon: Check, cls: 'bg-emerald-500 text-white', label: 'Passed' },
  failed: { icon: X, cls: 'bg-red-500 text-white', label: 'Failed' },
  clear: { icon: Circle, cls: 'bg-navy-50 text-navy-300', label: 'Not done' },
}

export function VettingCheckForm({
  staffId,
  type,
  title,
  badge,
  state,
  notes,
  confirmedAt,
}: {
  staffId: string
  type: string
  title: string
  badge: string
  state: CheckState
  notes: string
  confirmedAt: string | null
}) {
  const [open, setOpen] = useState(false)
  const [result, action] = useActionState<FormState, FormData>(saveVettingCheck, {})
  const ui = STATE_UI[state]

  return (
    <div className="rounded-2xl border border-brand-100 p-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 text-left" aria-expanded={open}>
        <span className={cn('grid size-7 shrink-0 place-items-center rounded-full', ui.cls)}>
          <ui.icon className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-navy-800">{title}</span>
          <span className="block text-xs text-navy-400">
            {ui.label}
            {confirmedAt && ` · ${confirmedAt}`} · unlocks {badge}
          </span>
        </span>
      </button>
      {open && (
        <form action={action} className="mt-3 grid gap-3 border-t border-brand-50 pt-3">
          <input type="hidden" name="staff_id" value={staffId} />
          <input type="hidden" name="check_type" value={type} />
          <Field label="Notes" name="notes" defaultValue={notes} maxLength={500} placeholder="Who checked, what was confirmed…" />
          <div className="flex flex-wrap gap-2">
            <SubmitButton name="state" value="passed" size="sm">Mark passed</SubmitButton>
            <SubmitButton name="state" value="failed" size="sm" variant="outline">Mark failed</SubmitButton>
            {state !== 'clear' && (
              <SubmitButton name="state" value="clear" size="sm" variant="ghost">Clear</SubmitButton>
            )}
          </div>
          <FormAlert error={result.error} message={result.message} />
        </form>
      )}
    </div>
  )
}

export function StaffLoginForm({ staffId }: { staffId: string }) {
  const [state, action] = useActionState<FormState, FormData>(grantStaffLogin, {})
  return (
    <form action={action} className="grid gap-3">
      <p className="text-sm text-navy-500">Optional: invite them by email to a read-only portal with their placements, schedule and ratings. They can never edit their profile.</p>
      <input type="hidden" name="staff_id" value={staffId} />
      <Field label="Their email" name="email" type="email" required />
      <FormAlert error={state.error} message={state.message} />
      <div>
        <SubmitButton size="sm" variant="navy">Send invitation</SubmitButton>
      </div>
    </form>
  )
}
