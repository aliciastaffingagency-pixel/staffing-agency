'use client'

import { Field, FormAlert, SubmitButton, TextArea, useFormAction, type FormState } from '@/components/ui/form'
import { saveAgency, saveTemplate } from './actions'

export function AgencyForm({
  agency,
}: {
  agency: { name: string; tagline: string | null; phone: string | null; whatsapp: string | null; email: string | null; service_area_label: string; address: string; odpc_registration: string; stats: string }
}) {
  const [state, onSubmit, pending] = useFormAction<FormState>(saveAgency, {})
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Agency name" name="name" required defaultValue={agency.name} />
        <Field label="Tagline" name="tagline" defaultValue={agency.tagline ?? ''} />
        <Field label="Phone" name="phone" required defaultValue={agency.phone ?? ''} />
        <Field label="WhatsApp number" name="whatsapp" required defaultValue={agency.whatsapp ? `+${agency.whatsapp}` : ''} />
        <Field label="Email" name="email" type="email" required defaultValue={agency.email ?? ''} />
        <Field label="Service area label" name="service_area_label" defaultValue={agency.service_area_label} />
        <Field label="Business address" name="address" defaultValue={agency.address} maxLength={200} placeholder="e.g. 2nd floor, Example House, Ngong Road, Nairobi" hint="Shown in the Privacy Policy and footer (required by data protection law)" />
        <Field label="ODPC registration number (optional)" name="odpc_registration" defaultValue={agency.odpc_registration} maxLength={60} hint="Office of the Data Protection Commissioner, once registered" />
      </div>
      <TextArea
        label="Homepage counters (optional)"
        name="stats"
        rows={4}
        defaultValue={agency.stats}
        placeholder={'Staff placed | 500 | +\nClient satisfaction | 98 | %'}
        hint="One per line: label | number | suffix. Only use real figures. The band stays hidden while this is empty."
      />
      <FormAlert error={state.error} message={state.message} />
      <div>
        <SubmitButton pending={pending}>Save agency details</SubmitButton>
      </div>
    </form>
  )
}

export function TemplateForm({
  template,
}: {
  template: { name: string; body: string; trial_period_days: number; notice_period_days: number; replacement_window_days: number; max_replacements: number }
}) {
  const [state, onSubmit, pending] = useFormAction<FormState>(saveTemplate, {})
  return (
    <form onSubmit={onSubmit} className="grid gap-4">
      <Field label="Template name" name="name" required defaultValue={template.name} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Trial period (days)" name="trial_period_days" type="number" min={0} defaultValue={template.trial_period_days} />
        <Field label="Notice period (days)" name="notice_period_days" type="number" min={0} defaultValue={template.notice_period_days} />
        <Field label="Replacement window (days)" name="replacement_window_days" type="number" min={0} defaultValue={template.replacement_window_days} />
        <Field label="Free replacements" name="max_replacements" type="number" min={0} defaultValue={template.max_replacements} />
      </div>
      <TextArea label="Contract text" name="body" rows={18} required defaultValue={template.body} className="font-mono" />
      <FormAlert error={state.error} message={state.message} />
      <div>
        <SubmitButton pending={pending}>Save as new version</SubmitButton>
      </div>
    </form>
  )
}
