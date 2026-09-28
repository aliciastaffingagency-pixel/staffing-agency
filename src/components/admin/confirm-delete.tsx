'use client'

import { useActionState, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { FormAlert, SubmitButton, type FormState } from '@/components/ui/form'

// Permanent-delete form: the user must type a phrase (a name, email or DELETE)
// before the button unlocks. The server action re-checks the phrase.
export function ConfirmDelete({
  action,
  id,
  phrase,
  title,
  button,
  deletes,
  keeps,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>
  id: string
  phrase: string
  title: string
  button: string
  deletes: string[]
  keeps?: string[]
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {})
  const [typed, setTyped] = useState('')
  const ok = typed.trim().toLowerCase() === phrase.trim().toLowerCase()

  return (
    <form action={formAction} className="grid gap-3 rounded-3xl border-2 border-red-200 bg-red-50/40 p-5">
      <input type="hidden" name="id" value={id} />
      <p className="flex items-center gap-2 font-bold text-red-700">
        <Trash2 className="size-5" /> {title}
      </p>
      <div className="grid gap-2 text-sm text-navy-700">
        <p>This permanently deletes:</p>
        <ul className="list-disc pl-5">
          {deletes.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
        {keeps && keeps.length > 0 && (
          <>
            <p>Kept for legal records:</p>
            <ul className="list-disc pl-5">
              {keeps.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </>
        )}
      </div>
      <label className="block text-sm">
        <span className="font-semibold text-navy-700">
          Type <strong className="select-all text-red-700">{phrase}</strong> to confirm
        </span>
        <input
          name="confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          className="mt-1.5 block h-11 w-full rounded-2xl border border-red-200 bg-white px-4 text-navy-800 outline-none focus:border-red-400 focus:ring-4 focus:ring-red-100"
        />
      </label>
      <FormAlert error={state.error} />
      <div>
        <SubmitButton size="sm" disabled={!ok} className="bg-red-600 text-white shadow-none hover:bg-red-700">
          {button}
        </SubmitButton>
      </div>
    </form>
  )
}
