'use client'

import { useActionState } from 'react'
import { FormAlert, Select, SubmitButton, TextArea, type FormState } from '@/components/ui/form'
import { APPLICATION_STATUSES } from '@/lib/jobs'
import { updateApplication } from '../../jobs/actions'

export function ApplicationReviewForm({ id, status, notes }: { id: string; status: string; notes: string }) {
  const [state, action] = useActionState<FormState, FormData>(updateApplication, {})
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="id" value={id} />
      <Select
        label="Status"
        name="status"
        defaultValue={status}
        options={APPLICATION_STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
      />
      <TextArea label="Private notes" name="admin_notes" rows={4} defaultValue={notes} placeholder="Interview notes, agreed terms, follow-ups…" />
      <FormAlert error={state.error} message={state.message} />
      <div>
        <SubmitButton size="sm">Save review</SubmitButton>
      </div>
    </form>
  )
}
