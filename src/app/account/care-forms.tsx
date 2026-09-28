'use client'

import { useActionState, useState } from 'react'
import { Star } from 'lucide-react'
import { Field, FormAlert, Select, SubmitButton, TextArea, useFormAction, type FormState } from '@/components/ui/form'
import { THREAD_KIND } from '@/lib/threads'
import type { Enums } from '@/lib/supabase/database.types'
import { cn } from '@/lib/utils'
import { fileClaim, startThread, submitRating } from './care-actions'

type Kind = Enums<'thread_kind'>

// Start a conversation — a plain question, or a request about a specific placement/claim.
export function RequestForm({
  kinds,
  bookingId,
  claimId,
  withSubject = false,
  submitLabel = 'Send',
}: {
  kinds: Kind[]
  bookingId?: string
  claimId?: string
  withSubject?: boolean
  submitLabel?: string
}) {
  const [state, onSubmit, pending] = useFormAction<FormState>(startThread, {})
  const [kind, setKind] = useState<Kind>(kinds[0])
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <input type="hidden" name="booking_id" value={bookingId ?? ''} />
      <input type="hidden" name="claim_id" value={claimId ?? ''} />
      {kinds.length > 1 ? (
        <Select
          label="What do you need?"
          name="kind"
          value={kind}
          onChange={(e) => setKind(e.target.value as Kind)}
          options={kinds.map((k) => ({ value: k, label: THREAD_KIND[k].client }))}
        />
      ) : (
        <input type="hidden" name="kind" value={kind} />
      )}
      {withSubject && <Field label="Subject" name="subject" maxLength={120} placeholder="e.g. Question about live-in nannies" />}
      <TextArea label="Message" name="body" required rows={4} maxLength={5000} placeholder={THREAD_KIND[kind].hint} />
      <FormAlert error={state.error} />
      <div>
        <SubmitButton pending={pending}>{submitLabel}</SubmitButton>
      </div>
    </form>
  )
}

export function RatingForm({ staffId, staffName, contractId, claimId }: { staffId: string; staffName: string; contractId?: string; claimId?: string }) {
  const [state, action] = useActionState<FormState, FormData>(submitRating, {})
  const [stars, setStars] = useState(0)
  const [hover, setHover] = useState(0)
  if (state.message) return <FormAlert message={state.message} />
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="staff_id" value={staffId} />
      <input type="hidden" name="contract_id" value={contractId ?? ''} />
      <input type="hidden" name="claim_id" value={claimId ?? ''} />
      <input type="hidden" name="stars" value={stars} />
      <fieldset>
        <legend className="text-sm font-semibold text-navy-700">How was {staffName}?</legend>
        <div className="mt-1.5 flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setStars(n)}
              onMouseEnter={() => setHover(n)}
              aria-label={`${n} star${n === 1 ? '' : 's'}`}
              aria-pressed={stars === n}
              className="rounded-lg p-0.5 transition hover:scale-110"
            >
              <Star className={cn('size-8', n <= (hover || stars) ? 'fill-gold-400 text-gold-500' : 'text-navy-200')} />
            </button>
          ))}
        </div>
      </fieldset>
      <TextArea label="Your review (optional)" name="comment" rows={3} maxLength={2000} placeholder="What did they do well? Anything to improve?" />
      <FormAlert error={state.error} />
      <div>
        <SubmitButton disabled={!stars}>Submit review</SubmitButton>
      </div>
      <p className="text-xs text-navy-400">Reviews are checked by the agency before they appear. Only your first name and area are shown.</p>
    </form>
  )
}

export function ClaimForm() {
  const [state, onSubmit, pending] = useFormAction<FormState>(fileClaim, {})
  return (
    <form onSubmit={onSubmit} className="grid gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Their full name" name="staff_full_name_freeform" required maxLength={120} />
        <Field label="Their phone (optional)" name="staff_phone_freeform" inputMode="tel" placeholder="0712 345 678" />
      </div>
      <TextArea label="Anything that helps us find them" name="notes" rows={3} maxLength={2000} placeholder="Role, when they started, how you found them…" />
      <FormAlert error={state.error} message={state.message} />
      <div>
        <SubmitButton pending={pending}>Send to the agency</SubmitButton>
      </div>
    </form>
  )
}
