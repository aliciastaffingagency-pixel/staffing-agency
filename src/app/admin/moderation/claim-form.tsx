'use client'

import { useActionState, useState } from 'react'
import { FormAlert, Select, SubmitButton, type FormState } from '@/components/ui/form'
import { reviewClaim } from './actions'

export function ClaimReviewForm({
  id,
  staff,
  categories,
  suggested,
}: {
  id: string
  staff: { id: string; label: string }[]
  categories: { id: string; name: string }[]
  suggested: string | null
}) {
  const [state, action] = useActionState<FormState, FormData>(reviewClaim, {})
  const [choice, setChoice] = useState(suggested ?? '')
  if (state.message) return <FormAlert message={state.message} />
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <Select
        label="Which staff member is this?"
        name="staff_id"
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        options={[
          { value: '', label: 'Choose…' },
          ...staff.map((s) => ({ value: s.id, label: s.label })),
          { value: 'new', label: '＋ Not on the system yet: create a profile' },
        ]}
      />
      {choice === 'new' && (
        <Select label="Their category" name="category_id" defaultValue="" options={[{ value: '', label: 'Choose…' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
      )}
      <FormAlert error={state.error} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton name="decision" value="confirm" size="sm">Confirm</SubmitButton>
        <SubmitButton name="decision" value="reject" size="sm" variant="ghost" className="text-red-600 hover:bg-red-50">Reject</SubmitButton>
      </div>
    </form>
  )
}
