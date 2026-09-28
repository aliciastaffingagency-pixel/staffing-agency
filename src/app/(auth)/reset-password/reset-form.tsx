'use client'

import { useActionState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, FormAlert } from '@/components/ui/form'
import { setNewPassword, type AuthState } from '../actions'

export function ResetForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(setNewPassword, {})
  return (
    <form action={action} className="grid gap-4">
      <Field label="New password" name="password" type="password" autoComplete="new-password" required minLength={8} hint="At least 8 characters" />
      <Field label="Type it again" name="confirm" type="password" autoComplete="new-password" required minLength={8} />
      <FormAlert error={state.error} />
      <Button type="submit" size="lg" disabled={pending} className="mt-1 w-full">
        {pending && <Loader2 className="size-5 animate-spin" />} Save new password
      </Button>
    </form>
  )
}
