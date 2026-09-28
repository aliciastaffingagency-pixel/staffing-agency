'use client'

import { useActionState } from 'react'
import { Building2, Home, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FormAlert } from '@/components/ui/form'
import { signUp, type AuthState } from '../actions'

export function SignupForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(signUp, {})
  const f = state.fields ?? {}

  if (state.message) return <FormAlert message={state.message} />

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="next" value={next} />
      <fieldset>
        <legend className="text-sm font-semibold text-navy-700">I&apos;m hiring for a…</legend>
        <div className="mt-1.5 grid grid-cols-2 gap-3">
          {[
            { value: 'household', label: 'Home', icon: Home },
            { value: 'business', label: 'Business', icon: Building2 },
          ].map((o) => (
            <label key={o.value} className="cursor-pointer">
              <input type="radio" name="client_kind" value={o.value} defaultChecked={(f.client_kind || 'household') === o.value} className="peer sr-only" />
              <span className="flex h-12 items-center justify-center gap-2 rounded-2xl border border-navy-100 bg-white font-semibold text-navy-600 transition peer-checked:border-brand-400 peer-checked:bg-brand-50 peer-checked:text-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100">
                <o.icon className="size-5" /> {o.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Full name" name="full_name" autoComplete="name" required defaultValue={f.full_name} />
      <Field label="Phone (M-Pesa number)" name="phone" type="tel" autoComplete="tel" required defaultValue={f.phone} placeholder="0712 345 678" />
      <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={f.email} placeholder="you@example.com" />
      <Field label="Password" name="password" type="password" autoComplete="new-password" required minLength={8} hint="At least 8 characters" />
      <FormAlert error={state.error} />
      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending && <Loader2 className="size-5 animate-spin" />} Create account
      </Button>
    </form>
  )
}
