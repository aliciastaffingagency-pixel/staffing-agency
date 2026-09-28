'use client'

import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { CheckCircle2, FileCheck2, Loader2, Paperclip, Plus, Upload, X } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { Checkbox, Field, FormAlert, SubmitButton, TextArea, useFormAction } from '@/components/ui/form'
import { APPLICATION_FILE_TYPES, APPLICATION_MAX_MB, ENGAGEMENT_LABEL, MAX_EXTRA_DOCUMENTS } from '@/lib/jobs'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { requestUploadUrl, submitApplication } from './actions'

type Doc = { label: string; path: string; name: string; size: number }
type State = { error?: string; message?: string; done?: boolean }

export function ApplicationForm({
  vacancyId,
  requiredDocuments,
  optionalDocuments = [],
}: {
  vacancyId?: string
  requiredDocuments: string[]
  optionalDocuments?: string[]
}) {
  const [state, onSubmit, pending] = useFormAction<State>(submitApplication, {})
  // One random folder per application attempt; files land in <agency>/<folder>/.
  const [folder] = useState(() => crypto.randomUUID())
  const [docs, setDocs] = useState<Record<string, Doc>>({})
  const [extras, setExtras] = useState<string[]>([])
  const [engagement, setEngagement] = useState<'join_agency' | 'own_terms' | ''>('')
  const [uploading, setUploading] = useState(0)

  if (state.done) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="rounded-[2rem] border border-emerald-100 bg-white p-10 text-center shadow-soft">
        <CheckCircle2 className="mx-auto size-14 text-emerald-500" />
        <p className="mt-4 font-script text-4xl text-brand-500">Asante sana!</p>
        <p className="mx-auto mt-3 max-w-md text-navy-600">{state.message}</p>
        <ButtonLink href="/jobs" variant="outline" className="mt-7">See other vacancies</ButtonLink>
      </motion.div>
    )
  }

  const slots = [...requiredDocuments.map((l) => ({ label: l, required: true })), ...optionalDocuments.filter((l) => !requiredDocuments.includes(l)).map((l) => ({ label: l, required: false })), ...extras.map((l) => ({ label: l, required: false }))]

  return (
    <form onSubmit={onSubmit} className="grid gap-8">
      <input type="hidden" name="vacancy_id" value={vacancyId ?? ''} />
      <input type="hidden" name="folder" value={folder} />
      <input type="hidden" name="documents" value={JSON.stringify(Object.values(docs))} />
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      <Card step={1} title="About you">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name" name="full_name" required maxLength={120} autoComplete="name" />
          <Field label="Phone number" name="phone" required inputMode="tel" autoComplete="tel" placeholder="0712 345 678" />
          <Field label="Email (optional)" name="email" type="email" autoComplete="email" />
          <Field label="Where do you live?" name="location_text" required maxLength={120} placeholder="e.g. Kawangware, Nairobi" />
          <Field label="Date of birth (optional)" name="date_of_birth" type="date" />
          <Field label="Years of experience" name="years_experience" type="number" min={0} max={60} />
          <Field label="Skills" name="skills" placeholder="Cooking, Childcare, Ironing" hint="Separate with commas" />
          <Field label="Languages" name="languages" placeholder="English, Kiswahili" hint="Separate with commas" />
        </div>
        <TextArea label="Tell us about yourself" name="cover_note" rows={4} maxLength={3000} placeholder="Past jobs, what you are good at, why you want this work…" />
      </Card>

      <Card step={2} title="How would you like to work with us?">
        <div className="grid gap-3 sm:grid-cols-2" role="radiogroup">
          {(Object.keys(ENGAGEMENT_LABEL) as (keyof typeof ENGAGEMENT_LABEL)[]).map((key) => (
            <label
              key={key}
              className={cn(
                'cursor-pointer rounded-2xl border-2 p-5 transition',
                engagement === key ? 'border-brand-500 bg-brand-50' : 'border-navy-100 bg-white hover:border-brand-200',
              )}
            >
              <input type="radio" name="engagement" value={key} required className="sr-only" onChange={() => setEngagement(key)} />
              <span className="flex items-center justify-between gap-2 font-bold text-navy-800">
                {ENGAGEMENT_LABEL[key].title}
                <span className={cn('grid size-5 place-items-center rounded-full border-2', engagement === key ? 'border-brand-500 bg-brand-500' : 'border-navy-200')}>
                  {engagement === key && <span className="size-2 rounded-full bg-white" />}
                </span>
              </span>
              <span className="mt-1.5 block text-sm leading-relaxed text-navy-500">{ENGAGEMENT_LABEL[key].text}</span>
            </label>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <Field label="Expected pay (KES, optional)" name="expected_pay" inputMode="numeric" placeholder="e.g. 15,000" />
          <label className="block">
            <span className="text-sm font-semibold text-navy-700">Per</span>
            <select name="expected_pay_period" className="mt-1.5 block h-12 w-full rounded-2xl border border-navy-100 bg-white px-4 text-navy-800">
              <option value="month">Month</option>
              <option value="day">Day</option>
            </select>
          </label>
        </div>
        <AnimatePresence initial={false}>
          {engagement === 'own_terms' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
              <TextArea
                label="The terms you would prefer"
                name="preferred_terms"
                required
                rows={4}
                maxLength={2000}
                placeholder="Pay, working days and hours, live-in or live-out, days off, start date…"
              />
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <Card step={3} title="Your documents">
        <p className="-mt-2 text-sm text-navy-500">
          PDF or photo (JPG, PNG), up to {APPLICATION_MAX_MB} MB each. Only the agency can see them.
        </p>
        <ul className="grid gap-3">
          {slots.map((slot) => (
            <DocumentSlot
              key={slot.label}
              label={slot.label}
              required={slot.required}
              folder={folder}
              doc={docs[slot.label]}
              onBusy={(d) => setUploading((n) => n + d)}
              onChange={(doc) =>
                setDocs((prev) => {
                  const next = { ...prev }
                  if (doc) next[slot.label] = doc
                  else delete next[slot.label]
                  return next
                })
              }
            />
          ))}
        </ul>
        {extras.length < MAX_EXTRA_DOCUMENTS && (
          <button
            type="button"
            onClick={() => setExtras((e) => [...e, `Other document ${e.length + 1}`])}
            className="inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed border-navy-200 px-4 py-2 text-sm font-medium text-navy-600 hover:border-brand-400 hover:text-brand-600"
          >
            <Plus className="size-4" /> Add another document
          </button>
        )}
      </Card>

      <div className="grid gap-4 rounded-3xl border border-brand-100 bg-white p-6">
        <Checkbox
          name="consent"
          required
          label="I confirm the information and documents are true and mine."
          hint="I agree that Alicia Staffing Agency may keep my details and documents to process my application, carry out vetting checks and contact me."
        />
        <p className="-mt-2 pl-8 text-xs text-navy-500">
          How we use and protect your documents:{' '}
          <a href="/privacy" target="_blank" className="font-semibold text-brand-600 hover:underline">Privacy Policy</a>
        </p>
        <FormAlert error={state.error} />
        <div>
          <SubmitButton size="lg" pending={pending} disabled={uploading > 0}>
            {uploading > 0 ? 'Waiting for uploads…' : 'Send my application'}
          </SubmitButton>
        </div>
      </div>
    </form>
  )
}

function Card({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-5 rounded-3xl border border-brand-100 bg-white p-6 sm:p-8">
      <h2 className="flex items-center gap-3 text-xl font-bold text-navy-800">
        <span className="grid size-8 place-items-center rounded-full bg-brand-500 text-sm text-white">{step}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

function DocumentSlot({
  label,
  required,
  folder,
  doc,
  onChange,
  onBusy,
}: {
  label: string
  required: boolean
  folder: string
  doc?: Doc
  onChange: (doc: Doc | null) => void
  onBusy: (delta: number) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)

  async function upload(file: File | undefined) {
    if (!file) return
    setError(null)
    if (!APPLICATION_FILE_TYPES.includes(file.type)) return setError('Use a PDF, JPG, PNG or WebP file.')
    if (file.size > APPLICATION_MAX_MB * 1024 * 1024) return setError(`That file is over ${APPLICATION_MAX_MB} MB.`)
    setBusy(true)
    onBusy(1)
    try {
      const ticket = await requestUploadUrl({ folder, fileName: file.name, size: file.size, type: file.type })
      if ('error' in ticket) throw new Error(ticket.error)
      const { error: upErr } = await createClient().storage.from('applications').uploadToSignedUrl(ticket.path!, ticket.token!, file, { contentType: file.type })
      if (upErr) throw upErr
      onChange({ label, path: ticket.path!, name: file.name, size: file.size })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed. Try again.')
    } finally {
      setBusy(false)
      onBusy(-1)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <li className={cn('flex flex-wrap items-center gap-3 rounded-2xl border p-4', doc ? 'border-emerald-200 bg-emerald-50/50' : 'border-navy-100')}>
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl', doc ? 'bg-emerald-500 text-white' : 'bg-brand-50 text-brand-500')}>
        {doc ? <FileCheck2 className="size-5" /> : <Paperclip className="size-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-navy-800">
          {label} {required ? <span className="text-brand-500">*</span> : <span className="font-normal text-navy-400">(optional)</span>}
        </span>
        <span className={cn('block truncate text-xs', error ? 'font-medium text-red-600' : 'text-navy-400')}>
          {error ?? (doc ? doc.name : 'Not uploaded yet')}
        </span>
      </span>
      <label className="inline-flex h-10 cursor-pointer items-center gap-1.5 rounded-full bg-navy-800 px-4 text-sm font-semibold text-white hover:bg-navy-700">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
        {doc ? 'Replace' : 'Upload'}
        <input ref={input} type="file" accept={APPLICATION_FILE_TYPES.join(',')} className="sr-only" disabled={busy} onChange={(e) => upload(e.target.files?.[0])} />
      </label>
      {doc && (
        <button type="button" onClick={() => onChange(null)} className="grid size-10 place-items-center rounded-full text-navy-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${label}`}>
          <X className="size-4" />
        </button>
      )}
    </li>
  )
}
