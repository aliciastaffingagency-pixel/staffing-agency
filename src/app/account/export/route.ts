import { getSession } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

// "Download my data" (right of access / portability). Everything is read through
// the signed-in user's own RLS view, so it can only ever contain their records.
export async function GET() {
  const session = await getSession()
  if (!session) return Response.json({ error: 'Please sign in.' }, { status: 401 })

  const supabase = await createClient()
  const [profile, clients, bookings, contracts, payments, threads, messages, ratings, claims, notifications] = await Promise.all([
    supabase.from('profiles').select('full_name, email, phone, role, terms_accepted_at, created_at').eq('id', session.id).single(),
    supabase.from('clients').select('name, email, phone, kind, location_text, created_at'),
    supabase.from('booking_requests').select('id, status, location_text, live_arrangement, start_date, budget, notes, created_at, staff_categories(name)'),
    supabase.from('contracts').select('id, booking_request_id, status, rate, rate_period, amount_due, starts_on, ends_on, terms_json, client_signature, client_signed_at, admin_signature, admin_signed_at, created_at'),
    supabase.from('payments').select('amount, currency, method, status, mpesa_receipt, paid_at, created_at'),
    supabase.from('message_threads').select('id, subject, kind, status, created_at'),
    supabase.from('messages').select('thread_id, sender_role, body, created_at').order('created_at'),
    supabase.from('ratings').select('stars, comment, is_published, created_at'),
    supabase.from('existing_staff_claims').select('staff_full_name_freeform, staff_phone_freeform, notes, status, created_at'),
    supabase.from('notifications').select('type, message, created_at').eq('target_user_id', session.id),
  ])

  const body = {
    exported_at: new Date().toISOString(),
    note: 'Personal data held about you by Alicia Staffing Agency. See /privacy for how it is used.',
    profile: profile.data,
    client_records: clients.data ?? [],
    booking_requests: bookings.data ?? [],
    contracts: contracts.data ?? [],
    payments: payments.data ?? [],
    conversations: (threads.data ?? []).map((t) => ({ ...t, messages: (messages.data ?? []).filter((m) => m.thread_id === t.id) })),
    reviews: ratings.data ?? [],
    staff_claims: claims.data ?? [],
    notifications: notifications.data ?? [],
  }
  const date = new Date().toISOString().slice(0, 10)
  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="alicia-my-data-${date}.json"`,
      'Cache-Control': 'no-store',
    },
  })
}
