'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CreditCard, Smartphone } from 'lucide-react'
import { Checkbox, Field, FormAlert, SubmitButton, type FormState } from '@/components/ui/form'
import { checkPayment, payWithCard, payWithMpesa, signContract } from '../../actions'

export function SignContractForm({ contractId, defaultName }: { contractId: string; defaultName: string }) {
  const [state, action] = useActionState<FormState, FormData>(signContract, {})
  return (
    <form action={action} className="grid gap-4 rounded-3xl border-2 border-brand-200 bg-white p-6">
      <input type="hidden" name="contract_id" value={contractId} />
      <p className="font-bold text-navy-800">Sign this contract</p>
      <Checkbox name="agree" required label="I have read and agree to the terms above." hint="Your typed name is your electronic signature. We record the date, time and your IP address." />
      <Field label="Type your full name" name="signature" required defaultValue={defaultName} autoComplete="name" />
      <FormAlert error={state.error} message={state.message} />
      <div>
        <SubmitButton size="lg">Sign contract</SubmitButton>
      </div>
    </form>
  )
}

export function PayPanel({
  contractId,
  outstanding,
  defaultPhone,
  mpesa,
  card,
  processing,
  agencyPhone,
}: {
  contractId: string
  outstanding: string
  defaultPhone: string
  mpesa: boolean
  card: boolean
  processing: boolean
  agencyPhone: string
}) {
  const [state, action] = useActionState<FormState & { started?: boolean }, FormData>(payWithMpesa, {})
  const router = useRouter()
  const [polls, setPolls] = useState(0)
  const waiting = processing || state.started

  // While a prompt is on the client's phone, refresh until the callback lands (~2 min).
  useEffect(() => {
    if (!waiting || polls > 30) return
    const t = setTimeout(() => {
      router.refresh()
      setPolls((n) => n + 1)
    }, 4000)
    return () => clearTimeout(t)
  }, [waiting, polls, router])

  if (!mpesa && !card) {
    return (
      <div className="rounded-3xl border-2 border-gold-300 bg-gold-100/50 p-6 text-sm text-navy-700">
        <p className="font-bold text-navy-800">Pay {outstanding} to confirm your placement</p>
        <p className="mt-2">
          Online payment is being set up. Please pay by M-Pesa to <strong>{agencyPhone}</strong> and reply with your M-Pesa code on
          WhatsApp. We&apos;ll mark it received here straight away.
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-4 rounded-3xl border-2 border-brand-200 bg-white p-6">
      <p className="font-bold text-navy-800">Pay {outstanding} to confirm your placement</p>
      {mpesa && (
        <form action={action} className="grid gap-3">
          <input type="hidden" name="contract_id" value={contractId} />
          <Field label="M-Pesa phone number" name="phone" required inputMode="tel" defaultValue={defaultPhone} placeholder="0712 345 678" />
          <FormAlert error={state.error} message={state.message} />
          <div className="flex flex-wrap gap-2">
            <SubmitButton variant="whatsapp">
              <Smartphone className="size-4" /> Pay with M-Pesa
            </SubmitButton>
          </div>
        </form>
      )}
      {waiting && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-gold-100/60 px-4 py-3 text-sm text-navy-700">
          <span className="size-2.5 animate-pulse rounded-full bg-gold-500" />
          Waiting for M-Pesa confirmation…
          <form action={checkPayment}>
            <input type="hidden" name="contract_id" value={contractId} />
            <button className="font-semibold text-brand-600 hover:underline">Check now</button>
          </form>
        </div>
      )}
      {card && (
        <form action={payWithCard} className={mpesa ? 'border-t border-dashed border-brand-100 pt-4' : ''}>
          <input type="hidden" name="contract_id" value={contractId} />
          <SubmitButton variant="navy">
            <CreditCard className="size-4" /> Pay by card
          </SubmitButton>
        </form>
      )}
    </div>
  )
}
