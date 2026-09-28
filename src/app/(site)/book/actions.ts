'use server'

import { redirect } from 'next/navigation'
import type { FormState } from '@/components/ui/form'
import { getSession } from '@/lib/auth'
import { createBookingOp } from '@/lib/services/client-ops'
import { createClient } from '@/lib/supabase/server'

export async function createBooking(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getSession()
  if (!session) redirect('/login?next=/book')
  const res = await createBookingOp({ supabase: await createClient(), session }, Object.fromEntries(formData))
  if (res.error !== undefined) return { error: res.error }
  redirect(`/account/bookings/${res.bookingId}?new=1`)
}
