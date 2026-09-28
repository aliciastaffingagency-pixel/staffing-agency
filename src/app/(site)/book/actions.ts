'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import type { FormState } from '@/components/ui/form'
import { getSession } from '@/lib/auth'
import { notify } from '@/lib/notify'
import { rateLimit } from '@/lib/rate-limit'
import { createClient } from '@/lib/supabase/server'
import { formatKes } from '@/lib/utils'

const bookingSchema = z.object({
  staff_id: z.union([z.uuid(), z.literal('')]).transform((v) => v || null),
  category_id: z.uuid('Choose the kind of staff you need'),
  start_date: z
    .union([z.iso.date(), z.literal('')])
    .transform((v) => v || null)
    .refine((v) => v === null || v >= new Date(Date.now() - 86_400_000).toISOString().slice(0, 10), 'The start date is in the past'),
  live_arrangement: z.enum(['live_in', 'live_out', 'either']),
  location_text: z.string().trim().min(2, 'Tell us where the job is').max(120),
  budget: z
    .string()
    .transform((v) => (v.trim() === '' ? null : Number(v.replace(/[,\s]/g, ''))))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 10_000_000), 'Enter your budget as a number'),
  notes: z.string().trim().max(3000).transform((v) => v || null),
})

export async function createBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession()
  if (!session) redirect('/login?next=/book')
  if (session.role !== 'client') return { error: 'Only client accounts can request staff.' }

  const s = (k: string) => String(formData.get(k) ?? '')
  const parsed = bookingSchema.safeParse({
    staff_id: s('staff_id'),
    category_id: s('category_id'),
    start_date: s('start_date'),
    live_arrangement: s('live_arrangement') || 'either',
    location_text: s('location_text'),
    budget: s('budget'),
    notes: s('notes'),
  })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!(await rateLimit('booking', 10, 3600, session.id))) return { error: 'You have sent many requests recently. Please try again later.' }

  const supabase = await createClient()
  const { data: client } = await supabase.from('clients').select('id, agency_id, name, location_text').eq('user_id', session.id).single()
  if (!client) return { error: 'We could not find your client profile. Please contact us.' }

  let staffName: string | null = null
  if (parsed.data.staff_id) {
    const { data: staff } = await supabase.from('staff_catalog').select('id, full_name, category_id').eq('id', parsed.data.staff_id).maybeSingle()
    if (!staff) return { error: 'That staff member is no longer listed. Choose someone else or request by role.' }
    parsed.data.category_id = staff.category_id!
    staffName = staff.full_name
  }

  const { data: booking, error } = await supabase
    .from('booking_requests')
    .insert({ ...parsed.data, agency_id: client.agency_id, client_id: client.id, status: 'pending' })
    .select('id, staff_categories(name)')
    .single()
  if (error) return { error: error.message }

  // Remember the area for next time.
  if (!client.location_text) await supabase.from('clients').update({ location_text: parsed.data.location_text }).eq('id', client.id)

  const role = booking.staff_categories?.name ?? 'staff'
  await notify({
    agencyId: client.agency_id,
    role: 'super_admin',
    type: 'new_request',
    subject: `New booking request: ${role}`,
    message: `${client.name ?? 'A client'} requested ${staffName ? `${staffName} (${role})` : `a ${role}`} in ${parsed.data.location_text}${parsed.data.budget ? `, budget ${formatKes(parsed.data.budget)}` : ''}.`,
    link: `/admin/bookings/${booking.id}`,
    sms: true,
  })
  redirect(`/account/bookings/${booking.id}?new=1`)
}
