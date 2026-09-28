'use client'

import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Field, FormAlert, Select, SubmitButton, TextArea, useFormAction, type FormState } from '@/components/ui/form'
import { DOCUMENT_SUGGESTIONS, EMPLOYMENT_LABEL } from '@/lib/jobs'
import type { Tables } from '@/lib/supabase/database.types'
import { saveVacancy } from './actions'

export function VacancyForm({
  vacancy,
  categories,
  initialMessage,
}: {
  vacancy?: Tables<'vacancies'>
  categories: { id: string; name: string }[]
  initialMessage?: string
}) {
  const [state, onSubmit, pending] = useFormAction<FormState>(saveVacancy, { message: initialMessage })
  const [docs, setDocs] = useState<string[]>(vacancy?.required_documents ?? ['National ID', 'CV / Résumé'])
  const [draft, setDraft] = useState('')

  const addDoc = (name: string) => {
    const v = name.trim()
    if (v && !docs.some((d) => d.toLowerCase() === v.toLowerCase()) && docs.length < 10) setDocs([...docs, v])
    setDraft('')
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-6 rounded-3xl border border-brand-100 bg-white p-6">
      {vacancy && <input type="hidden" name="id" value={vacancy.id} />}
      <div className="grid gap-4 md:grid-cols-[1.5fr_1fr]">
        <Field label="Job title" name="title" required maxLength={120} defaultValue={vacancy?.title} placeholder="e.g. Live-in Nanny for 2 toddlers" />
        <Select
          label="Category"
          name="category_id"
          defaultValue={vacancy?.category_id ?? ''}
          options={[{ value: '', label: 'No category' }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
        />
      </div>
      <TextArea label="Job description" name="description" required rows={5} maxLength={5000} defaultValue={vacancy?.description} placeholder="Duties, working hours, household or business details…" />
      <TextArea label="Requirements" name="requirements" rows={3} maxLength={3000} defaultValue={vacancy?.requirements ?? ''} placeholder="Experience, languages, age range, skills…" />

      <div className="grid gap-4 md:grid-cols-3">
        <Field label="Location" name="location_text" maxLength={120} defaultValue={vacancy?.location_text ?? ''} placeholder="e.g. Karen, Nairobi" />
        <Select
          label="Employment type"
          name="employment_type"
          defaultValue={vacancy?.employment_type ?? 'full_time'}
          options={Object.entries(EMPLOYMENT_LABEL).map(([value, label]) => ({ value, label }))}
        />
        <Select
          label="Live-in / live-out"
          name="live_arrangement"
          defaultValue={vacancy?.live_arrangement ?? 'either'}
          options={[
            { value: 'either', label: 'Either' },
            { value: 'live_in', label: 'Live-in' },
            { value: 'live_out', label: 'Live-out' },
          ]}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Field label="Pay from (KES)" name="pay_min" inputMode="numeric" defaultValue={vacancy?.pay_min ?? ''} />
        <Field label="Pay up to (KES)" name="pay_max" inputMode="numeric" defaultValue={vacancy?.pay_max ?? ''} />
        <Select label="Per" name="pay_period" defaultValue={vacancy?.pay_period ?? 'month'} options={[{ value: 'month', label: 'Month' }, { value: 'day', label: 'Day' }]} />
        <Field label="Positions" name="positions" type="number" min={1} max={500} defaultValue={vacancy?.positions ?? 1} />
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-navy-700">Documents applicants must upload</legend>
        {docs.map((d) => (
          <input key={d} type="hidden" name="required_documents" value={d} />
        ))}
        <div className="mt-2 flex flex-wrap gap-2">
          {docs.map((d) => (
            <span key={d} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-sm font-medium text-brand-700">
              {d}
              <button type="button" onClick={() => setDocs(docs.filter((x) => x !== d))} className="grid size-6 place-items-center rounded-full hover:bg-brand-100" aria-label={`Remove ${d}`}>
                <X className="size-3.5" />
              </button>
            </span>
          ))}
          {!docs.length && <span className="text-sm text-navy-400">No documents required.</span>}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {DOCUMENT_SUGGESTIONS.filter((s) => !docs.includes(s)).map((s) => (
            <button key={s} type="button" onClick={() => addDoc(s)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-navy-200 px-3 py-1 text-xs font-medium text-navy-500 hover:border-brand-400 hover:text-brand-600">
              <Plus className="size-3" /> {s}
            </button>
          ))}
        </div>
        <div className="mt-3 flex max-w-md gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addDoc(draft)
              }
            }}
            maxLength={60}
            placeholder="Other document…"
            className="h-10 flex-1 rounded-full border border-navy-100 px-4 text-sm outline-none focus:border-brand-400"
          />
          <button type="button" onClick={() => addDoc(draft)} className="h-10 rounded-full bg-navy-800 px-4 text-sm font-semibold text-white">
            Add
          </button>
        </div>
      </fieldset>

      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Applications close on" name="closes_on" type="date" defaultValue={vacancy?.closes_on ?? ''} hint="Leave empty to keep it open until you close it" />
        <Select
          label="Status"
          name="status"
          defaultValue={vacancy?.status ?? 'open'}
          options={[
            { value: 'open', label: 'Open: visible on the jobs page' },
            { value: 'draft', label: 'Draft: not visible yet' },
            { value: 'closed', label: 'Closed: no longer accepting' },
            { value: 'filled', label: 'Filled' },
          ]}
        />
      </div>

      <FormAlert error={state.error} message={state.message} />
      <div>
        <SubmitButton size="lg" pending={pending}>{vacancy ? 'Save vacancy' : 'Post vacancy'}</SubmitButton>
      </div>
    </form>
  )
}
