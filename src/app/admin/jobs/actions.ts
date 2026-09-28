'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { FormState } from '@/components/ui/form'
import { APPLICATION_STATUSES } from '@/lib/jobs'
import { requireRole } from '@/lib/auth'
import { deleteApplication } from '@/lib/services/erasure'
import { createClient } from '@/lib/supabase/server'
import { splitList } from '@/lib/utils'

const money = z
  .string()
  .trim()
  .transform((v) => (v === '' ? null : Number(v.replace(/,/g, ''))))
  .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 10_000_000), 'Enter a valid amount')

const vacancySchema = z
  .object({
    title: z.string().trim().min(3, 'Give the vacancy a title').max(120),
    category_id: z.union([z.uuid(), z.literal('')]).transform((v) => v || null),
    description: z.string().trim().min(10, 'Describe the job (at least a sentence)').max(5000),
    requirements: z.string().trim().max(3000).transform((v) => v || null),
    location_text: z.string().trim().max(120).transform((v) => v || null),
    employment_type: z.enum(['full_time', 'part_time', 'contract', 'temporary', 'casual']),
    live_arrangement: z.enum(['live_in', 'live_out', 'either']),
    pay_min: money,
    pay_max: money,
    pay_period: z.enum(['day', 'month']),
    positions: z.coerce.number().int().min(1).max(500),
    required_documents: z.array(z.string().max(60)).max(10),
    closes_on: z.union([z.iso.date(), z.literal('')]).transform((v) => v || null),
    status: z.enum(['draft', 'open', 'closed', 'filled']),
  })
  .refine((v) => v.pay_min == null || v.pay_max == null || v.pay_min <= v.pay_max, 'Minimum pay is higher than maximum pay')

export async function saveVacancy(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('super_admin')
  const s = (k: string) => String(formData.get(k) ?? '')
  const parsed = vacancySchema.safeParse({
    title: s('title'),
    category_id: s('category_id'),
    description: s('description'),
    requirements: s('requirements'),
    location_text: s('location_text'),
    employment_type: s('employment_type'),
    live_arrangement: s('live_arrangement'),
    pay_min: s('pay_min'),
    pay_max: s('pay_max'),
    pay_period: s('pay_period'),
    positions: s('positions') || '1',
    required_documents: splitList(formData.getAll('required_documents').join(',')),
    closes_on: s('closes_on'),
    status: s('status'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const id = s('id')
  const now = new Date().toISOString()

  if (id) {
    const { data: current } = await supabase.from('vacancies').select('published_at').eq('id', id).single()
    const { error } = await supabase
      .from('vacancies')
      .update({ ...parsed.data, published_at: current?.published_at ?? (parsed.data.status === 'open' ? now : null) })
      .eq('id', id)
    if (error) return { error: error.message }
    revalidatePath('/admin/jobs', 'layout')
    revalidatePath('/jobs', 'layout')
    return { message: parsed.data.status === 'open' ? 'Saved. The vacancy is live on the jobs page.' : 'Saved.' }
  }

  const { data, error } = await supabase
    .from('vacancies')
    .insert({ ...parsed.data, agency_id: session.agency_id, created_by: session.id, published_at: parsed.data.status === 'open' ? now : null })
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/admin/jobs', 'layout')
  revalidatePath('/jobs', 'layout')
  redirect(`/admin/jobs/${data.id}?created=1`)
}

export async function setVacancyStatus(formData: FormData) {
  await requireRole('super_admin')
  const id = z.uuid().parse(formData.get('id'))
  const status = z.enum(['draft', 'open', 'closed', 'filled']).parse(formData.get('status'))
  const supabase = await createClient()
  const { data: current } = await supabase.from('vacancies').select('published_at').eq('id', id).single()
  await supabase
    .from('vacancies')
    .update({ status, published_at: current?.published_at ?? (status === 'open' ? new Date().toISOString() : null) })
    .eq('id', id)
  revalidatePath('/admin/jobs', 'layout')
  revalidatePath('/jobs', 'layout')
}

export async function deleteVacancy(formData: FormData) {
  await requireRole('super_admin')
  const id = z.uuid().parse(formData.get('id'))
  const supabase = await createClient()
  // Applications survive as general applications (vacancy_id → null).
  await supabase.from('vacancies').delete().eq('id', id)
  revalidatePath('/admin/jobs', 'layout')
  revalidatePath('/jobs', 'layout')
  redirect('/admin/jobs')
}

// ---------------------------------------------------------------------------
// Applications
// ---------------------------------------------------------------------------
export async function updateApplication(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('super_admin')
  const parsed = z
    .object({
      id: z.uuid(),
      status: z.enum(APPLICATION_STATUSES),
      admin_notes: z.string().trim().max(3000).transform((v) => v || null),
    })
    .safeParse({ id: formData.get('id'), status: formData.get('status'), admin_notes: String(formData.get('admin_notes') ?? '') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase
    .from('job_applications')
    .update({ status: parsed.data.status, admin_notes: parsed.data.admin_notes, reviewed_by: session.id, reviewed_at: new Date().toISOString() })
    .eq('id', parsed.data.id)
  if (error) return { error: error.message }
  revalidatePath('/admin/applications', 'layout')
  revalidatePath('/admin', 'layout')
  return { message: 'Application updated.' }
}

// Turns an accepted applicant into a staff profile (inactive until the admin
// finishes it), copying their details and ID document across.
export async function convertToStaff(formData: FormData) {
  const session = await requireRole('super_admin')
  const id = z.uuid().parse(formData.get('id'))
  const categoryId = z.uuid().parse(formData.get('category_id'))
  const supabase = await createClient()

  const { data: app } = await supabase.from('job_applications').select('*').eq('id', id).eq('agency_id', session.agency_id).single()
  if (!app) return
  if (app.staff_id) redirect(`/admin/staff/${app.staff_id}`)

  const { data: staff, error } = await supabase
    .from('staff_profiles')
    .insert({
      agency_id: session.agency_id,
      category_id: categoryId,
      full_name: app.full_name,
      bio: app.cover_note,
      skills: app.skills,
      languages: app.languages,
      location_text: app.location_text,
      years_experience: app.years_experience,
      month_rate: app.expected_pay_period === 'month' ? app.expected_pay : null,
      day_rate: app.expected_pay_period === 'day' ? app.expected_pay : null,
      is_active: false,
    })
    .select('id')
    .single()
  if (error || !staff) throw new Error(error?.message ?? 'Could not create staff profile')

  // Copy the ID document (if any) into the private staff-docs bucket.
  const docs = (Array.isArray(app.documents) ? app.documents : []) as { label?: string; path?: string }[]
  const idDoc = docs.find((d) => /national id|id card|passport/i.test(d.label ?? '')) ?? null
  if (idDoc?.path) {
    const { data: file } = await supabase.storage.from('applications').download(idDoc.path)
    if (file) {
      const ext = idDoc.path.split('.').pop() ?? 'pdf'
      const dest = `${session.agency_id}/${staff.id}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('staff-docs').upload(dest, file, { contentType: file.type })
      if (!upErr) await supabase.from('staff_profiles').update({ id_doc_url: dest }).eq('id', staff.id)
    }
  }

  await supabase
    .from('job_applications')
    .update({ staff_id: staff.id, status: 'accepted', reviewed_by: session.id, reviewed_at: new Date().toISOString() })
    .eq('id', id)
  revalidatePath('/admin', 'layout')
  redirect(`/admin/staff/${staff.id}?created=1`)
}

// Permanently deletes an application and its uploaded documents.
export async function removeApplication(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('super_admin')
  const id = z.uuid().safeParse(formData.get('id'))
  if (!id.success) return { error: 'Unknown application' }
  if (String(formData.get('confirm') ?? '').trim().toUpperCase() !== 'DELETE') return { error: 'Type DELETE to confirm.' }
  const res = await deleteApplication(session.agency_id, id.data)
  if (res.error !== undefined) return { error: res.error }
  revalidatePath('/admin', 'layout')
  redirect(`/admin/applications?deleted=${encodeURIComponent(res.name)}`)
}
