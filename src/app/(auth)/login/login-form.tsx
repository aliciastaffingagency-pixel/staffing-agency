'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FormAlert } from '@/components/ui/form'
import { sendMagicLink, signIn, type AuthState } from '../actions'

export function LoginForm({ next, initialError }: { next: string; initialError?: string }) {
  const [mode, setMode] = useState<'password' | 'link'>('password')
  const [pwState, pwAction, pwPending] = useActionState<AuthState, FormData>(signIn, { error: initialError })
  const [linkState, linkAction, linkPending] = useActionState<AuthState, FormData>(sendMagicLink, {})

  const state = mode === 'password' ? pwState : linkState
  const pending = mode === 'password' ? pwPending : linkPending

  return (
    <div>
      <div className="grid grid-cols-2 rounded-full bg-brand-50 p-1 text-sm font-semibold">
        {(['password', 'link'] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full py-2 transition ${mode === m ? 'bg-white text-brand-600 shadow-sm' : 'text-navy-500 hover:text-navy-700'}`}
          >
            {m === 'password' ? 'Password' : 'Email me a link'}
          </button>
        ))}
      </div>

      <form action={mode === 'password' ? pwAction : linkAction} className="mt-6 grid gap-4">
        <input type="hidden" name="next" value={next} />
        <Field label="Email" name="email" type="email" autoComplete="email" required defaultValue={pwState.fields?.email} placeholder="you@example.com" />
        {mode === 'password' && (
          <div>
            <Field label="Password" name="password" type="password" autoComplete="current-password" required />
            <Link href="/forgot-password" className="mt-2 inline-block text-sm font-semibold text-brand-600 hover:underline">
              Forgot password?
            </Link>
          </div>
        )}
        <FormAlert error={state.error} message={state.message} />
        <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
          {pending ? <Loader2 className="size-5 animate-spin" /> : mode === 'link' && <Mail className="size-5" />}
          {mode === 'password' ? 'Log in' : 'Send login link'}
        </Button>
      </form>
    </div>
  )
}
