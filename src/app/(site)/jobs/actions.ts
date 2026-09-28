'use server'

import { z } from 'zod'
import type { FormState } from '@/components/ui/form'
import { getAgency } from '@/lib/agency'
import { getSession } from '@/lib/auth'
import { APPLICATION_FILE_TYPES, APPLICATION_MAX_MB, GENERAL_DOCUMENTS, MAX_EXTRA_DOCUMENTS } from '@/lib/jobs'
import { notify } from '@/lib/notify'
import { rateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeKePhone, splitList } from '@/lib/utils'

// Step 1: the browser asks for a one-time signed URL per file and uploads the
// file directly to the private "applications" bucket (no server body limits).
export async function requestUploadUrl(input: { folder: string; fileName: string; size: number; type: string }) {
  const parsed = z
    .object({
      folder: z.uuid(),
      fileName: z.string().max(200),
      size: z.number().int().positive().max(APPLICATION_MAX_MB * 1024 * 1024),
      type: z.enum(APPLICATION_FILE_TYPES as [string, ...string[]]),
    })
    .safeParse(input)
  if (!parsed.success) return { error: `Upload a PDF, JPG, PNG or WebP file under ${APPLICATION_MAX_MB} MB.` }
  if (!(await rateLimit('application-upload', 40, 3600))) return { error: 'Too many uploads. Please try again in a while.' }

  const agency = await getAgency()
  const ext = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[parsed.data.type]
  const path = `${agency.id}/${parsed.data.folder}/${crypto.randomUUID()}.${ext}`
  const { data, error } = await createAdminClient().storage.from('applications').createSignedUploadUrl(path)
  if (error || !data) return { error: 'Could not start the upload. Please try again.' }
  return { path: data.path, token: data.token }
}

const docSchema = z.object({
  label: z.string().trim().min(1).max(80),
  path: z.string().max(300),
  name: z.string().max(200),
  size: z.number().int().nonnegative(),
})

const applicationSchema = z
  .object({
    vacancy_id: z.union([z.uuid(), z.literal('')]).transform((v) => v || null),
    folder: z.uuid(),
    full_name: z.string().trim().min(2, 'Enter your full name').max(120),
    phone: z.string().transform((v, ctx) => {
      const p = normalizeKePhone(v)
      if (!p) ctx.addIssue({ code: 'custom', message: 'Enter a valid Kenyan phone number, e.g. 0712 345 678' })
      return p ?? ''
    }),
    email: z.union([z.email('Enter a valid email address'), z.literal('')]).transform((v) => v || null),
    location_text: z.string().trim().min(2, 'Tell us where you live').max(120),
    date_of_birth: z.union([z.iso.date(), z.literal('')]).transform((v) => v || null),
    years_experience: z
      .string()
      .transform((v) => (v === '' ? null : Number(v)))
      .refine((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 60), 'Years of experience should be a whole number'),
    skills: z.array(z.string().max(60)).max(30),
    languages: z.array(z.string().max(40)).max(15),
    cover_note: z.string().trim().max(3000).transform((v) => v || null),
    engagement: z.enum(['join_agency', 'own_terms'], 'Choose how you would like to work with us'),
    preferred_terms: z.string().trim().max(2000).transform((v) => v || null),
    expected_pay: z
      .string()
      .transform((v) => (v.trim() === '' ? null : Number(v.replace(/[,\s]/g, ''))))
      .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 10_000_000), 'Enter your expected pay as a number'),
    expected_pay_period: z.enum(['day', 'month']),
    documents: z.array(docSchema).max(15),
    consent: z.literal(true, 'Please confirm the declaration to apply'),
  })
  .refine((v) => v.engagement !== 'own_terms' || (v.preferred_terms && v.preferred_terms.length >= 5), {
    message: 'Describe the terms you would prefer (pay, days, live-in or out…)',
  })

export async function submitApplication(_prev: FormState, formData: FormData): Promise<FormState & { done?: boolean }> {
  // Bots fill every field; people never see this one.
  if (String(formData.get('website') ?? '') !== '') return { done: true, message: 'Thank you!' }

  const s = (k: string) => String(formData.get(k) ?? '')
  let documents: unknown = []
  try {
    documents = JSON.parse(s('documents') || '[]')
  } catch {
    return { error: 'Your documents didn’t upload properly. Please re-add them.' }
  }
  const parsed = applicationSchema.safeParse({
    vacancy_id: s('vacancy_id'),
    folder: s('folder'),
    full_name: s('full_name'),
    phone: s('phone'),
    email: s('email').trim().toLowerCase(),
    location_text: s('location_text'),
    date_of_birth: s('date_of_birth'),
    years_experience: s('years_experience').trim(),
    skills: splitList(formData.get('skills')),
    languages: splitList(formData.get('languages')),
    cover_note: s('cover_note'),
    engagement: s('engagement') || undefined,
    preferred_terms: s('preferred_terms'),
    expected_pay: s('expected_pay'),
    expected_pay_period: s('expected_pay_period') === 'day' ? 'day' : 'month',
    documents,
    consent: formData.get('consent') === 'on',
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const data = parsed.data

  if (!(await rateLimit('application-submit', 8, 3600))) {
    return { error: 'You have sent several applications already. Please try again later or WhatsApp us.' }
  }

  const agency = await getAgency()
  const admin = createAdminClient()

  // Vacancy must be open. General applications need the default documents.
  let required = GENERAL_DOCUMENTS.slice(0, 1)
  let vacancyTitle: string | null = null
  if (data.vacancy_id) {
    const { data: vacancy } = await admin
      .from('vacancies')
      .select('id, title, status, closes_on, required_documents, agency_id')
      .eq('id', data.vacancy_id)
      .maybeSingle()
    const today = new Date().toISOString().slice(0, 10)
    if (!vacancy || vacancy.agency_id !== agency.id || vacancy.status !== 'open' || (vacancy.closes_on && vacancy.closes_on < today)) {
      return { error: 'Sorry, this vacancy is no longer accepting applications.' }
    }
    required = vacancy.required_documents
    vacancyTitle = vacancy.title
  }

  // Every document must be a file this applicant uploaded into their own folder.
  const folder = `${agency.id}/${data.folder}`
  const { data: stored } = await admin.storage.from('applications').list(folder, { limit: 100 })
  const storedNames = new Set((stored ?? []).map((f) => `${folder}/${f.name}`))
  for (const d of data.documents) {
    if (!d.path.startsWith(`${folder}/`) || !storedNames.has(d.path)) {
      return { error: `“${d.label}” didn’t finish uploading. Please upload it again.` }
    }
  }
  const missing = required.filter((r) => !data.documents.some((d) => d.label === r))
  if (missing.length) return { error: `Please upload: ${missing.join(', ')}` }
  if (data.documents.length > required.length + MAX_EXTRA_DOCUMENTS) return { error: 'Too many documents attached.' }

  // One live application per phone number per vacancy.
  let dupe = admin.from('job_applications').select('id').eq('agency_id', agency.id).eq('phone', data.phone).not('status', 'in', '(rejected,withdrawn)')
  dupe = data.vacancy_id ? dupe.eq('vacancy_id', data.vacancy_id) : dupe.is('vacancy_id', null)
  const { data: existing } = await dupe.limit(1)
  if (existing?.length) return { error: 'You have already applied with this phone number. We’ll be in touch soon!' }

  const session = await getSession()
  const { error } = await admin.from('job_applications').insert({
    vacancy_id: data.vacancy_id,
    full_name: data.full_name,
    phone: data.phone,
    email: data.email,
    location_text: data.location_text,
    date_of_birth: data.date_of_birth,
    years_experience: data.years_experience,
    skills: data.skills,
    languages: data.languages,
    cover_note: data.cover_note,
    engagement: data.engagement,
    preferred_terms: data.preferred_terms,
    expected_pay: data.expected_pay,
    expected_pay_period: data.expected_pay_period,
    documents: data.documents,
    agency_id: agency.id,
    applicant_user_id: session?.id ?? null,
    consent_at: new Date().toISOString(),
  })
  if (error) {
    console.error('application insert failed', error.message)
    return { error: 'Something went wrong saving your application. Please try again.' }
  }

  await notify({
    agencyId: agency.id,
    role: 'super_admin',
    type: 'new_application',
    subject: `New job application: ${data.full_name}`,
    message: `${data.full_name} applied ${vacancyTitle ? `for “${vacancyTitle}”` : 'to join the agency'} (${data.engagement === 'join_agency' ? 'wants to join as a member' : 'wants to agree own terms'}).`,
    link: '/admin/applications',
  })

  return {
    done: true,
    message: `Thank you, ${data.full_name.split(' ')[0]}! Your application has been received. We’ll contact you on ${data.phone}.`,
  }
}
