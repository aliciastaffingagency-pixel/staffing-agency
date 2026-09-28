'use client'

import { useState } from 'react'
import { Field, FormAlert, Select, SubmitButton, TextArea, useFormAction, type FormState } from '@/components/ui/form'
import { AREA_NAMES } from '@/lib/areas'
import { createBooking } from './actions'
import { StaffPicker, type StaffOption } from './staff-picker'

export function BookingForm({
  staffId,
  categoryId,
  categories,
  staffByCategory,
  defaultLocation,
  defaultLive,
}: {
  staffId?: string
  categoryId?: string
  categories: { id: string; name: string }[]
  staffByCategory: Record<string, StaffOption[]>
  defaultLocation?: string | null
  defaultLive?: 'live_in' | 'live_out' | 'either'
}) {
  const [state, onSubmit, pending] = useFormAction<FormState>(createBooking, {})
  const today = new Date().toISOString().slice(0, 10)
  const [category, setCategory] = useState(categoryId ?? '')
  const [picked, setPicked] = useState(staffId ?? '')
  const options = staffByCategory[category] ?? []

  return (
    <form onSubmit={onSubmit} className="grid gap-5 rounded-[2rem] border border-brand-100 bg-white p-6 shadow-soft sm:p-8">
      <Select
        label="What kind of help do you need?"
        name="category_id"
        required
        value={category}
        onChange={(e) => {
          setCategory(e.target.value)
          setPicked('')
        }}
        options={[{ value: '', label: 'Choose a service…' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
      />
      {category && (
        <StaffPicker
          options={options}
          value={picked}
          onChange={setPicked}
          categoryName={categories.find((c) => c.id === category)?.name ?? 'staff'}
        />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Preferred start date" name="start_date" type="date" min={today} />
        <Select
          label="Live-in or live-out?"
          name="live_arrangement"
          defaultValue={defaultLive ?? 'either'}
          options={[
            { value: 'either', label: 'Either is fine' },
            { value: 'live_in', label: 'Live-in' },
            { value: 'live_out', label: 'Live-out' },
          ]}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-semibold text-navy-700">Where is the job?</span>
          <input
            name="location_text"
            required
            list="book-areas"
            maxLength={120}
            defaultValue={defaultLocation ?? ''}
            placeholder="e.g. Kilimani, Nairobi"
            className="mt-1.5 block h-12 w-full rounded-2xl border border-navy-100 bg-white px-4 text-navy-800 outline-none transition placeholder:text-navy-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
          />
          <datalist id="book-areas">
            {AREA_NAMES.map((a) => (
              <option key={a} value={a} />
            ))}
          </datalist>
        </label>
        <Field label="Monthly budget (KES, optional)" name="budget" inputMode="numeric" placeholder="e.g. 15,000" />
      </div>
      <TextArea
        label="Tell us about the job"
        name="notes"
        rows={4}
        maxLength={3000}
        placeholder="Household size, children's ages, duties, working days, languages, anything important…"
      />
      <FormAlert error={state.error} />
      <div>
        <SubmitButton size="lg" pending={pending}>Send request</SubmitButton>
      </div>
      <p className="text-xs text-navy-400">
        No payment now. We confirm the match with you first, then send a digital contract to sign. By sending a request you agree to our{' '}
        <a href="/terms" target="_blank" className="font-semibold text-brand-600 hover:underline">Terms</a> and{' '}
        <a href="/privacy" target="_blank" className="font-semibold text-brand-600 hover:underline">Privacy Policy</a>.
      </p>
    </form>
  )
}
