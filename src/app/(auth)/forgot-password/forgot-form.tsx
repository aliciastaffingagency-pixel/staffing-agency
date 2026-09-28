'use client'

import { useActionState } from 'react'
import { Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FormAlert } from '@/components/ui/form'
import { requestPasswordReset, type AuthState } from '../actions'

export function ForgotForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, {})
  if (state.message) return <FormAlert message={state.message} />
  return (
    <form action={action} className="grid gap-4">
      <Field label="Email" name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      <FormAlert error={state.error} />
      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending ? <Loader2 className="size-5 animate-spin" /> : <Mail className="size-5" />} Email me a reset link
      </Button>
    </form>
  )
}
