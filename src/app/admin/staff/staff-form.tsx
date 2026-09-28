'use client'

import { FileUpload } from '@/components/admin/file-upload'
import { LocationPicker } from '@/components/map/location-picker'
import { Checkbox, Field, FormAlert, Select, SubmitButton, TextArea, useFormAction, type FormState } from '@/components/ui/form'
import type { Tables } from '@/lib/supabase/database.types'
import { saveStaff } from './actions'

type Staff = Tables<'staff_profiles'>

export function StaffForm({
  staff,
  agencyId,
  categories,
  mapCenter,
  idDocPreview,
  initialMessage,
}: {
  staff?: Staff
  agencyId: string
  categories: { id: string; name: string; is_active: boolean }[]
  mapCenter: [number, number]
  idDocPreview?: string | null
  initialMessage?: string
}) {
  const [state, onSubmit, pending] = useFormAction<FormState>(saveStaff, { message: initialMessage })
  const folder = `${agencyId}/${staff?.id ?? 'new'}`

  return (
    <form onSubmit={onSubmit} className="grid gap-8">
      {staff && <input type="hidden" name="id" value={staff.id} />}

      <Section title="Who they are">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Full name" name="full_name" required maxLength={120} defaultValue={staff?.full_name} />
          <Select
            label="Category"
            name="category_id"
            required
            defaultValue={staff?.category_id ?? ''}
            options={[
              { value: '', label: 'Choose a category…' },
              ...categories.map((c) => ({ value: c.id, label: c.is_active ? c.name : `${c.name} (hidden)` })),
            ]}
          />
        </div>
        <FileUpload
          label="Profile photo"
          name="photo_url"
          bucket="staff-photos"
          folder={folder}
          accept="image/jpeg,image/png,image/webp"
          maxMb={5}
          kind="image"
          defaultValue={staff?.photo_url}
          previewUrl={staff?.photo_url}
          hint="A clear, friendly head-and-shoulders photo. JPG, PNG or WebP, up to 5 MB."
        />
        <TextArea label="Bio" name="bio" rows={4} maxLength={2000} defaultValue={staff?.bio ?? ''} placeholder="Experience, personality, what previous employers valued…" />
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Skills" name="skills" defaultValue={staff?.skills.join(', ')} placeholder="Cooking, Childcare, Ironing" hint="Separate with commas" />
          <Field label="Languages" name="languages" defaultValue={staff?.languages.join(', ')} placeholder="English, Kiswahili" hint="Separate with commas" />
        </div>
        <Field label="Intro video link" name="video_url" type="url" defaultValue={staff?.video_url ?? ''} placeholder="https://…" hint="Optional 20–30 second intro (YouTube, Drive or a direct .mp4 link)" />
      </Section>

      <Section title="Work details">
        <div className="grid gap-4 md:grid-cols-3">
          <Select
            label="Availability"
            name="availability"
            defaultValue={staff?.availability ?? 'available'}
            options={[
              { value: 'available', label: 'Available' },
              { value: 'placed', label: 'Currently placed' },
              { value: 'unavailable', label: 'Unavailable' },
            ]}
          />
          <Select
            label="Live-in / live-out"
            name="live_arrangement"
            defaultValue={staff?.live_arrangement ?? 'either'}
            options={[
              { value: 'either', label: 'Either' },
              { value: 'live_in', label: 'Live-in' },
              { value: 'live_out', label: 'Live-out' },
            ]}
          />
          <Field label="Years of experience" name="years_experience" type="number" min={0} max={60} defaultValue={staff?.years_experience ?? ''} />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Day rate (KES)" name="day_rate" inputMode="numeric" defaultValue={staff?.day_rate ?? ''} placeholder="e.g. 1,000" />
          <Field label="Monthly rate (KES)" name="month_rate" inputMode="numeric" defaultValue={staff?.month_rate ?? ''} placeholder="e.g. 15,000" />
        </div>
        <LocationPicker center={mapCenter} defaultText={staff?.location_text} defaultLat={staff?.lat} defaultLng={staff?.lng} label="Home area" />
      </Section>

      <Section title="Private documents">
        <FileUpload
          label="National ID / vetting document"
          name="id_doc_url"
          bucket="staff-docs"
          folder={folder}
          accept="image/jpeg,image/png,image/webp,application/pdf"
          maxMb={10}
          kind="document"
          defaultValue={staff?.id_doc_url}
          previewUrl={idDocPreview}
          hint="Only admins can see this. Never shown on the website."
        />
      </Section>

      <Section title="Visibility">
        <Checkbox label="Show in the public catalog" name="is_active" defaultChecked={staff?.is_active ?? true} hint="Untick to deactivate. The profile and history are kept." />
        <Checkbox
          label="Vetting rejected"
          name="vetting_rejected"
          defaultChecked={staff?.vetting_status === 'rejected'}
          hint="Marks the person as failing vetting. Badges come from the vetting checks, not from this form."
        />
      </Section>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-4 rounded-3xl border border-brand-100 bg-white/95 p-4 shadow-soft backdrop-blur">
        <SubmitButton size="lg" pending={pending}>{staff ? 'Save profile' : 'Create profile'}</SubmitButton>
        <div className="min-w-0 flex-1">
          <FormAlert error={state.error} message={state.message} />
        </div>
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-4 rounded-3xl border border-brand-100 bg-white p-6">
      <legend className="float-left mb-1 text-lg font-bold text-navy-800">{title}</legend>
      {children}
    </fieldset>
  )
}
