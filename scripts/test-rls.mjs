// End-to-end check of RLS policies and column grants using throwaway users.
// node scripts/test-rls.mjs   (cleans up after itself)
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'

config({ path: '.env.local', quiet: true })

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const service = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, opts)
const anon = createClient(URL, ANON, opts)

let failures = 0
const check = (name, ok, detail = '') => {
  if (!ok) failures++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${!ok && detail ? `  → ${detail}` : ''}`)
}

const started = new Date().toISOString()
const tag = randomBytes(4).toString('hex')
const created = []

async function makeUser(label) {
  const email = `rls-${label}-${tag}@example.test`
  const password = randomBytes(12).toString('base64url')
  const { data, error } = await service.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { full_name: `Test ${label}`, agency_slug: 'alicia', role: 'super_admin' }, // role must be ignored
  })
  if (error) throw error
  created.push(data.user.id)
  const client = createClient(URL, ANON, opts)
  const { error: signInError } = await client.auth.signInWithPassword({ email, password })
  if (signInError) throw signInError
  return { id: data.user.id, client }
}

try {
  // ---- anonymous visitor
  const cats = await anon.from('staff_categories').select('id, slug')
  check('anon reads active categories', cats.data?.length >= 11, cats.error?.message)
  const catalog = await anon.from('staff_catalog').select('id')
  check('anon reads staff_catalog view', !catalog.error, catalog.error?.message)
  const anonProfiles = await anon.from('profiles').select('id')
  check('anon cannot read profiles', (anonProfiles.data ?? []).length === 0)
  const anonStaff = await anon.from('staff_profiles').select('id, id_doc_url')
  check('anon cannot read raw staff_profiles', (anonStaff.data ?? []).length === 0)
  const anonInsert = await anon.from('booking_requests').insert({ agency_id: '00000000-0000-0000-0000-000000000000', client_id: '00000000-0000-0000-0000-000000000000', category_id: cats.data[0].id })
  check('anon cannot create bookings', Boolean(anonInsert.error))

  // ---- two clients
  const a = await makeUser('a')
  const b = await makeUser('b')

  const aProfile = await a.client.from('profiles').select('role, agency_id').single()
  check('signup creates client profile (metadata role ignored)', aProfile.data?.role === 'client', JSON.stringify(aProfile.data))
  const aClients = await a.client.from('clients').select('id, agency_id')
  check('client sees exactly own client row', aClients.data?.length === 1)
  const aClientId = aClients.data[0].id
  const agencyId = aClients.data[0].agency_id

  const escalate = await a.client.from('profiles').update({ role: 'super_admin' }).eq('id', a.id)
  check('client cannot change own role', Boolean(escalate.error), 'update succeeded')
  const rename = await a.client.from('profiles').update({ full_name: 'Renamed A' }).eq('id', a.id).select()
  check('client can update own name', rename.data?.length === 1, rename.error?.message)
  const moveAgency = await a.client.from('clients').update({ agency_id: '00000000-0000-0000-0000-000000000000' }).eq('id', aClientId)
  check('client cannot change agency_id', Boolean(moveAgency.error))

  const booking = await a.client.from('booking_requests')
    .insert({ agency_id: agencyId, client_id: aClientId, category_id: cats.data[0].id, notes: 'rls test' }).select().single()
  check('client creates pending booking', !booking.error, booking.error?.message)
  const activeBooking = await a.client.from('booking_requests')
    .insert({ agency_id: agencyId, client_id: aClientId, category_id: cats.data[0].id, status: 'active' })
  check('client cannot create non-pending booking', Boolean(activeBooking.error))
  const bClientRow = await b.client.from('clients').select('id').single()
  const spoof = await a.client.from('booking_requests')
    .insert({ agency_id: agencyId, client_id: bClientRow.data.id, category_id: cats.data[0].id })
  check("client cannot book on another client's behalf", Boolean(spoof.error))

  const bSees = await b.client.from('booking_requests').select('id')
  check("client B cannot see client A's booking", (bSees.data ?? []).length === 0)
  const bSeesA = await b.client.from('clients').select('id').eq('id', aClientId)
  check("client B cannot see client A's record", (bSeesA.data ?? []).length === 0)

  const catInsert = await a.client.from('staff_categories').insert({ agency_id: agencyId, name: 'Hacker', slug: `hack-${tag}` })
  check('client cannot create categories', Boolean(catInsert.error))
  const audit = await a.client.from('audit_log').select('id')
  check('client cannot read audit log', (audit.data ?? []).length === 0)
  const fakeRating = await a.client.from('ratings').insert({ agency_id: agencyId, client_id: aClientId, staff_id: '00000000-0000-0000-0000-000000000000', stars: 5, claim_id: '00000000-0000-0000-0000-000000000000' })
  check('client cannot rate staff they never hired', Boolean(fakeRating.error))

  // ---- a temporary admin
  const admin = await makeUser('admin')
  await service.from('profiles').update({ role: 'super_admin' }).eq('id', admin.id)
  const adminBookings = await admin.client.from('booking_requests').select('id').eq('id', booking.data.id)
  check("admin sees clients' bookings", adminBookings.data?.length === 1, adminBookings.error?.message)
  const newCat = await admin.client.from('staff_categories')
    .insert({ agency_id: agencyId, name: `Test Category ${tag}`, slug: `test-${tag}`, icon: 'Dog' }).select().single()
  check('admin adds a category live', !newCat.error, newCat.error?.message)
  if (newCat.data) {
    const del = await admin.client.from('staff_categories').delete().eq('id', newCat.data.id).select()
    check('admin removes a category', del.data?.length === 1, del.error?.message)
  }
  const adminAudit = await admin.client.from('audit_log').select('id').gte('created_at', started)
  check('admin reads audit log (category changes recorded)', (adminAudit.data ?? []).length >= 2, adminAudit.error?.message)
} finally {
  for (const id of created) await service.auth.admin.deleteUser(id)
  await service.from('audit_log').delete().gte('created_at', started)
  console.log(`\ncleaned up ${created.length} test users`)
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll RLS checks passed')
process.exit(failures ? 1 : 0)
