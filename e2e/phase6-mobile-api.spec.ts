import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { service, users } from './helpers'

// The Expo app talks to these JSON endpoints with the user's Supabase access token.
test('mobile API: auth required, booking, push token, conversation, smart match', async ({ request }) => {
  test.setTimeout(180_000)
  const { client, agencyId, tag } = users()
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } })
  const { data: login, error } = await sb.auth.signInWithPassword({ email: client.email, password: client.password })
  expect(error).toBeNull()
  const auth = { Authorization: `Bearer ${login.session!.access_token}` }

  expect((await request.post('/api/mobile/bookings', { data: {} })).status()).toBe(401)
  expect((await request.post('/api/mobile/bookings', { data: {}, headers: { Authorization: 'Bearer not-a-token' } })).status()).toBe(401)

  const { data: cat } = await service.from('staff_categories').select('id').eq('agency_id', agencyId).eq('slug', 'house-help').single()
  const booking = await request.post('/api/mobile/bookings', {
    headers: auth,
    data: { category_id: cat!.id, live_arrangement: 'live_out', location_text: 'Westlands', notes: `From the app ${tag}` },
  })
  expect(booking.status()).toBe(200)
  const { bookingId } = await booking.json()
  const { data: row } = await service.from('booking_requests').select('client_id, status, notes').eq('id', bookingId).single()
  expect(row).toMatchObject({ client_id: client.clientId, status: 'pending', notes: `From the app ${tag}` })

  const bad = await request.post('/api/mobile/bookings', { headers: auth, data: { category_id: cat!.id, location_text: '' } })
  expect(bad.status()).toBe(400)
  expect((await bad.json()).error).toMatch(/where the job is/)

  const push = await request.post('/api/mobile/push-token', { headers: auth, data: { token: `ExponentPushToken[test-${tag}]`, platform: 'android' } })
  expect(push.status()).toBe(200)
  expect((await request.post('/api/mobile/push-token', { headers: auth, data: { token: 'junk' } })).status()).toBe(400)

  const thread = await request.post('/api/mobile/threads', { headers: auth, data: { kind: 'general', subject: 'From the app', body: 'Hello from my phone' } })
  expect(thread.status()).toBe(200)
  const { threadId } = await thread.json()
  const msg = await request.post('/api/mobile/messages', { headers: auth, data: { thread_id: threadId, body: 'Second message' } })
  expect(msg.status()).toBe(200)
  const { count } = await service.from('messages').select('id', { count: 'exact', head: true }).eq('thread_id', threadId)
  expect(count).toBe(2)

  const match = await request.post('/api/match', { data: { query: 'A house help in Westlands, live-out' } })
  expect(match.status()).toBe(200)
  expect(await match.json()).toHaveProperty('summary')

  await service.from('push_tokens').delete().like('token', `%${tag}%`)
})
