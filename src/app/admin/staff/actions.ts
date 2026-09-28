'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { FormState } from '@/components/ui/form'
import { requireRole } from '@/lib/auth'
import { siteUrl } from '@/lib/site-url'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { splitList } from '@/lib/utils'

const optionalNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : Number(v.replace(/,/g, ''))))
    .refine((v) => v === null || (Number.isFinite(v) && v >= min && v <= max), `Enter a valid number for ${label}`)

const staffSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter the staff member’s full name').max(120),
  category_id: z.uuid('Pick a category'),
  bio: z.string().trim().max(2000).transform((v) => v || null),
  skills: z.array(z.string().max(60)).max(30),
  languages: z.array(z.string().max(40)).max(15),
  location_text: z.string().trim().max(120).transform((v) => v || null),
  lat: optionalNumber('the map pin', -90, 90),
  lng: optionalNumber('the map pin', -180, 180),
  availability: z.enum(['available', 'placed', 'unavailable']),
  live_arrangement: z.enum(['live_in', 'live_out', 'either']),
  day_rate: optionalNumber('day rate', 0, 1_000_000),
  month_rate: optionalNumber('monthly rate', 0, 10_000_000),
  years_experience: optionalNumber('years of experience', 0, 60).transform((v) => (v === null ? null : Math.round(v))),
  photo_url: z.string().trim().max(500).transform((v) => v || null),
  video_url: z
    .string()
    .trim()
    .max(500)
    .transform((v) => v || null)
    .refine((v) => v === null || /^https:\/\//.test(v), 'Video link must start with https://'),
  id_doc_url: z.string().trim().max(500).transform((v) => v || null),
  is_active: z.boolean(),
  vetting_rejected: z.boolean(),
})

function readStaff(formData: FormData) {
  const s = (k: string) => String(formData.get(k) ?? '')
  return staffSchema.safeParse({
    full_name: s('full_name'),
    category_id: s('category_id'),
    bio: s('bio'),
    skills: splitList(formData.get('skills')),
    languages: splitList(formData.get('languages')),
    location_text: s('location_text'),
    lat: s('lat'),
    lng: s('lng'),
    availability: s('availability'),
    live_arrangement: s('live_arrangement'),
    day_rate: s('day_rate'),
    month_rate: s('month_rate'),
    years_experience: s('years_experience'),
    photo_url: s('photo_url'),
    video_url: s('video_url'),
    id_doc_url: s('id_doc_url'),
    is_active: formData.get('is_active') === 'on',
    vetting_rejected: formData.get('vetting_rejected') === 'on',
  })
}

export async function saveStaff(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('super_admin')
  const parsed = readStaff(formData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { vetting_rejected, ...data } = parsed.data

  // Files must be the ones our uploader put in this agency's storage folders.
  const photoPrefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/staff-photos/${session.agency_id}/`
  if (data.photo_url && !data.photo_url.startsWith(photoPrefix)) return { error: 'Please upload the photo again.' }
  if (data.id_doc_url && !data.id_doc_url.startsWith(`${session.agency_id}/`)) return { error: 'Please upload the ID document again.' }
  if ((data.lat === null) !== (data.lng === null)) return { error: 'Pin the location on the map again.' }

  const supabase = await createClient()
  const id = String(formData.get('id') ?? '')

  if (id) {
    const { data: current } = await supabase.from('staff_profiles').select('vetting_status').eq('id', id).single()
    if (!current) return { error: 'Staff profile not found' }
    // "Rejected" is the one vetting status the admin sets by hand; the rest follow the checks.
    let vetting_status = current.vetting_status
    if (vetting_rejected) vetting_status = 'rejected'
    else if (current.vetting_status === 'rejected') vetting_status = 'in_review'

    const { error } = await supabase.from('staff_profiles').update({ ...data, vetting_status }).eq('id', id)
    if (error) return { error: error.message }
    if (current.vetting_status === 'rejected' && !vetting_rejected) await recomputeBadges(id)
    revalidatePath('/admin/staff', 'layout')
    revalidatePath('/', 'layout')
    return { message: 'Profile saved.' }
  }

  const { data: created, error } = await supabase
    .from('staff_profiles')
    .insert({ ...data, agency_id: session.agency_id, vetting_status: vetting_rejected ? 'rejected' : 'pending' })
    .select('id')
    .single()
  if (error) return { error: error.message }
  revalidatePath('/admin/staff', 'layout')
  revalidatePath('/', 'layout')
  redirect(`/admin/staff/${created.id}?created=1`)
}

// Touching a check re-runs the badge trigger after un-rejecting someone.
async function recomputeBadges(staffId: string) {
  const admin = createAdminClient()
  const { data } = await admin.from('staff_vetting_checks').select('id, passed').eq('staff_id', staffId).limit(1).maybeSingle()
  if (data) await admin.from('staff_vetting_checks').update({ passed: data.passed }).eq('id', data.id)
  else await admin.from('staff_profiles').update({ vetting_status: 'pending' }).eq('id', staffId)
}

export async function setStaffActive(formData: FormData) {
  await requireRole('super_admin')
  const id = z.uuid().parse(formData.get('id'))
  const supabase = await createClient()
  await supabase.from('staff_profiles').update({ is_active: formData.get('active') === 'true' }).eq('id', id)
  revalidatePath('/admin/staff', 'layout')
  revalidatePath('/', 'layout')
}

const CHECKS = ['id_verification', 'reference_check', 'background_check', 'training'] as const

export async function saveVettingCheck(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('super_admin')
  const parsed = z
    .object({
      staff_id: z.uuid(),
      check_type: z.enum(CHECKS),
      state: z.enum(['passed', 'failed', 'clear']),
      notes: z.string().trim().max(500).transform((v) => v || null),
    })
    .safeParse({
      staff_id: formData.get('staff_id'),
      check_type: formData.get('check_type'),
      state: formData.get('state'),
      notes: String(formData.get('notes') ?? ''),
    })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { staff_id, check_type, state, notes } = parsed.data

  const supabase = await createClient()
  const { error } =
    state === 'clear'
      ? await supabase.from('staff_vetting_checks').delete().eq('staff_id', staff_id).eq('check_type', check_type)
      : await supabase.from('staff_vetting_checks').upsert(
          {
            agency_id: session.agency_id,
            staff_id,
            check_type,
            passed: state === 'passed',
            notes,
            confirmed_by: session.id,
            confirmed_at: new Date().toISOString(),
          },
          { onConflict: 'staff_id,check_type' },
        )
  if (error) return { error: error.message }
  revalidatePath(`/admin/staff/${staff_id}`)
  revalidatePath('/', 'layout')
  return { message: 'Vetting record updated. Badges refreshed.' }
}

// Gives a staff member a read-only login (placements, schedule, own ratings).
export async function grantStaffLogin(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('super_admin')
  const parsed = z
    .object({ staff_id: z.uuid(), email: z.string().trim().toLowerCase().email('Enter a valid email') })
    .safeParse({ staff_id: formData.get('staff_id'), email: formData.get('email') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: staff } = await supabase.from('staff_profiles').select('id, full_name, user_id, agency_id').eq('id', parsed.data.staff_id).single()
  if (!staff || staff.agency_id !== session.agency_id) return { error: 'Staff profile not found' }
  if (staff.user_id) return { error: 'This staff member already has a login.' }

  const admin = createAdminClient()
  const site = siteUrl()
  const { data: invited, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
    data: { full_name: staff.full_name, agency_slug: process.env.NEXT_PUBLIC_AGENCY_SLUG ?? 'alicia' },
    redirectTo: `${site}/auth/callback?next=/staff-portal`,
  })
  if (error) return { error: /already been registered/i.test(error.message) ? 'That email already has an account. Use a different email.' : error.message }

  const userId = invited.user.id
  // The signup trigger made them a client; staff are not clients.
  await admin.from('profiles').update({ role: 'staff' }).eq('id', userId)
  await admin.from('clients').delete().eq('user_id', userId)
  const { error: linkErr } = await admin.from('staff_profiles').update({ user_id: userId }).eq('id', staff.id)
  if (linkErr) return { error: linkErr.message }

  revalidatePath(`/admin/staff/${staff.id}`)
  return { message: `Invitation sent to ${parsed.data.email}. They can log in to see their placements and ratings.` }
}
