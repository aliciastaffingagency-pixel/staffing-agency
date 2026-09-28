'use client'

import { useActionState } from 'react'
import { Field, FormAlert, Select, SubmitButton, TextArea, useFormAction, type FormState } from '@/components/ui/form'
import { assignStaff, countersignContract, createContract, endPlacement, recordManualPayment } from '../actions'

export function AssignStaffForm({
  bookingId,
  current,
  confirmed,
  candidates,
}: {
  bookingId: string
  current: string | null
  confirmed: boolean
  candidates: { id: string; label: string }[]
}) {
  const [state, action] = useActionState<FormState, FormData>(assignStaff, {})
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="booking_id" value={bookingId} />
      <Select
        label={current ? (confirmed ? 'Change staff member' : 'Client asked for') : 'Assign a staff member'}
        name="staff_id"
        defaultValue={current ?? ''}
        options={[{ value: '', label: candidates.length ? 'Choose…' : 'No active staff in this category yet' }, ...candidates.map((c) => ({ value: c.id, label: c.label }))]}
      />
      <FormAlert error={state.error} message={state.message} />
      <div>
        <SubmitButton size="sm">{!current ? 'Assign & notify client' : confirmed ? 'Reassign & notify client' : 'Confirm match & notify client'}</SubmitButton>
      </div>
    </form>
  )
}

export function ContractForm({
  bookingId,
  defaults,
}: {
  bookingId: string
  defaults: { rate: number | null; rate_period: 'day' | 'month'; starts_on: string | null; duties: string | null; live: string; fee: number | null }
}) {
  const [state, onSubmit, pending] = useFormAction<FormState>(createContract, {})
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <input type="hidden" name="booking_id" value={bookingId} />
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Field label="Staff pay (KES)" name="rate" inputMode="numeric" defaultValue={defaults.rate ?? ''} hint="What the client pays the staff member" />
        <Select label="Per" name="rate_period" defaultValue={defaults.rate_period} options={[{ value: 'month', label: 'Month' }, { value: 'day', label: 'Day' }]} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date" name="starts_on" type="date" defaultValue={defaults.starts_on ?? ''} />
        <Field label="End date (optional)" name="ends_on" type="date" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Agency fee due (KES)" name="amount_due" inputMode="numeric" required defaultValue={defaults.fee ?? ''} hint="Paid by the client to the agency on signing" />
        <Select
          label="Arrangement"
          name="live_arrangement"
          defaultValue={defaults.live}
          options={[
            { value: 'either', label: 'As agreed' },
            { value: 'live_in', label: 'Live-in' },
            { value: 'live_out', label: 'Live-out' },
          ]}
        />
      </div>
      <TextArea label="Duties" name="duties" rows={3} defaultValue={defaults.duties ?? ''} placeholder="Main duties, working days and hours…" />
      <FormAlert error={state.error} message={state.message} />
      <div>
        <SubmitButton pending={pending}>Generate & send contract</SubmitButton>
      </div>
    </form>
  )
}

export function CountersignForm({ contractId, defaultName }: { contractId: string; defaultName: string }) {
  const [state, action] = useActionState<FormState, FormData>(countersignContract, {})
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="contract_id" value={contractId} />
      <Field label="Type your full name to countersign" name="signature" required defaultValue={defaultName} />
      <FormAlert error={state.error} message={state.message} />
      <div>
        <SubmitButton size="sm" variant="navy">Countersign for the agency</SubmitButton>
      </div>
    </form>
  )
}

export function ManualPaymentForm({ contractId, outstanding }: { contractId: string; outstanding: number }) {
  const [state, action] = useActionState<FormState, FormData>(recordManualPayment, {})
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="contract_id" value={contractId} />
      <div className="grid grid-cols-2 gap-3">
        <Select
          label="Method"
          name="method"
          defaultValue="mpesa"
          options={[
            { value: 'mpesa', label: 'M-Pesa' },
            { value: 'bank', label: 'Bank transfer' },
            { value: 'cash', label: 'Cash' },
            { value: 'card', label: 'Card' },
          ]}
        />
        <Field label="Amount (KES)" name="amount" inputMode="numeric" defaultValue={outstanding || ''} required />
      </div>
      <Field label="Receipt / reference" name="reference" placeholder="e.g. SJK3XYZ12A" />
      <FormAlert error={state.error} message={state.message} />
      <div>
        <SubmitButton size="sm" variant="outline">Record payment</SubmitButton>
      </div>
    </form>
  )
}

export function EndPlacementForm({ contractId }: { contractId: string }) {
  const [state, action] = useActionState<FormState, FormData>(endPlacement, {})
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="contract_id" value={contractId} />
      <Field label="Reason" name="reason" required placeholder="Contract finished / client ended / replaced…" />
      <FormAlert error={state.error} message={state.message} />
      <div>
        <SubmitButton size="sm" variant="ghost" className="text-red-600 hover:bg-red-50">End placement</SubmitButton>
      </div>
    </form>
  )
}
