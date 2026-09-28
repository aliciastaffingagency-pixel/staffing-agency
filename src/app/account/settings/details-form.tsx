'use client'

import { useActionState } from 'react'
import { Field, FormAlert, SubmitButton, type FormState } from '@/components/ui/form'
import { updateMyDetails } from './actions'

export function DetailsForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [state, action] = useActionState<FormState, FormData>(updateMyDetails, {})
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" name="full_name" required defaultValue={name} autoComplete="name" />
        <Field label="Phone (M-Pesa number)" name="phone" required defaultValue={phone} inputMode="tel" autoComplete="tel" />
      </div>
      <Field label="Email" value={email} disabled readOnly hint="Your sign-in email. Contact us if you need to change it." />
      <FormAlert error={state.error} message={state.message} />
      <div>
        <SubmitButton size="sm">Save details</SubmitButton>
      </div>
    </form>
  )
}
