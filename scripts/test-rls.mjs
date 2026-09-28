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
const createdStaff = []

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
  const redact = await admin.client.rpc('redact_audit_entries', { p_targets: [], p_refs: [], p_reason: 'test' })
  check('only the server can redact the audit log', Boolean(redact.error))

  // ---- Phase 2: staff profiles, derived badges, catalog
  const staff = await admin.client.from('staff_profiles')
    .insert({ agency_id: agencyId, category_id: cats.data[0].id, full_name: `Test Staff ${tag}`, month_rate: 15000, verified_badge: true, rating_avg: 5 })
    .select('id, verified_badge, rating_avg').single()
  check('admin creates staff profile', !staff.error, staff.error?.message)
  const staffId = staff.data?.id
  if (staffId) createdStaff.push(staffId)
  check('insert cannot smuggle badges/ratings', staff.data?.verified_badge === false && Number(staff.data?.rating_avg) === 0, JSON.stringify(staff.data))
  const badgeEdit = await admin.client.from('staff_profiles').update({ trained_badge: true }).eq('id', staffId)
  check('admin cannot set badges directly', Boolean(badgeEdit.error))
  await admin.client.from('staff_vetting_checks').insert({ agency_id: agencyId, staff_id: staffId, check_type: 'id_verification', confirmed_by: admin.id })
  await admin.client.from('staff_vetting_checks').insert({ agency_id: agencyId, staff_id: staffId, check_type: 'training', confirmed_by: admin.id })
  const afterChecks = await admin.client.from('staff_profiles').select('verified_badge, trained_badge, background_checked_badge, vetting_status').eq('id', staffId).single()
  check('vetting checks drive badges', afterChecks.data?.verified_badge && afterChecks.data?.trained_badge && !afterChecks.data?.background_checked_badge && afterChecks.data?.vetting_status === 'in_review', JSON.stringify(afterChecks.data))
  const noConsent = await anon.from('staff_catalog').select('id').eq('id', staffId)
  check('staff stay out of the catalog until their consent is recorded', !noConsent.error && (noConsent.data ?? []).length === 0, noConsent.error?.message)
  const consent = await admin.client.from('staff_profiles').update({ publish_consent_at: new Date().toISOString() }).eq('id', staffId).select('id')
  check('admin records publishing consent', consent.data?.length === 1, consent.error?.message)
  const anonCatalog = await anon.from('staff_catalog').select('id, month_rate').eq('id', staffId)
  check('anon sees staff in catalog with rate', anonCatalog.data?.[0]?.month_rate === 15000, anonCatalog.error?.message)
  const clientChecks = await a.client.from('staff_vetting_checks').select('id').eq('staff_id', staffId)
  check('client cannot read vetting checks', (clientChecks.data ?? []).length === 0)
  const clientStaffEdit = await a.client.from('staff_profiles').update({ full_name: 'hacked' }).eq('id', staffId).select()
  check('client cannot edit staff', (clientStaffEdit.data ?? []).length === 0)

  // ---- Phase 4: messaging guard + ratings
  const thread = await a.client.from('message_threads').insert({ agency_id: agencyId, client_id: aClientId, subject: 'Hi', kind: 'general' }).select('id').single()
  check('client opens a thread', !thread.error, thread.error?.message)
  const msg = await a.client.from('messages').insert({ thread_id: thread.data?.id, sender_id: a.id, sender_role: 'client', body: 'Hello' })
  check('client sends a message (thread trigger allowed)', !msg.error, msg.error?.message)
  const fakeRole = await a.client.from('messages').insert({ thread_id: thread.data?.id, sender_id: a.id, sender_role: 'super_admin', body: 'I am admin' })
  check('client cannot post as admin', Boolean(fakeRole.error))
  const resolve = await a.client.from('message_threads').update({ status: 'resolved' }).eq('id', thread.data?.id)
  check('client cannot resolve threads', Boolean(resolve.error))
  const markRead = await a.client.from('message_threads').update({ client_last_read_at: new Date().toISOString() }).eq('id', thread.data?.id).select()
  check('client can mark thread read', markRead.data?.length === 1, markRead.error?.message)
  const bThread = await b.client.from('messages').select('id').eq('thread_id', thread.data?.id)
  check("client B cannot read A's messages", (bThread.data ?? []).length === 0)
  const bPost = await b.client.from('messages').insert({ thread_id: thread.data?.id, sender_id: b.id, sender_role: 'client', body: 'intrude' })
  check("client B cannot post in A's thread", Boolean(bPost.error))
  const selfPublish = await a.client.from('ratings').insert({ agency_id: agencyId, client_id: aClientId, staff_id: staffId, stars: 5, is_published: true, claim_id: '00000000-0000-0000-0000-000000000000' })
  check('client cannot self-publish a rating', Boolean(selfPublish.error))

  // ---- Jobs board
  const draft = await admin.client.from('vacancies').insert({ agency_id: agencyId, title: `Draft job ${tag}`, description: 'A draft vacancy for tests', status: 'draft' }).select('id').single()
  const open = await admin.client.from('vacancies').insert({ agency_id: agencyId, title: `Open job ${tag}`, description: 'An open vacancy for tests', status: 'open', required_documents: ['National ID'] }).select('id').single()
  check('admin posts vacancies', !draft.error && !open.error, draft.error?.message ?? open.error?.message)
  const anonJobs = await anon.from('vacancies').select('id').in('id', [draft.data?.id, open.data?.id])
  check('public sees only open vacancies', anonJobs.data?.length === 1 && anonJobs.data[0].id === open.data?.id, JSON.stringify(anonJobs.data))
  const anonApply = await anon.from('job_applications').insert({ agency_id: agencyId, full_name: 'Bot', phone: '+254700000000', engagement: 'join_agency' })
  check('public cannot write applications directly', Boolean(anonApply.error))
  const app = await service.from('job_applications').insert({ agency_id: agencyId, vacancy_id: open.data?.id, full_name: 'Applicant Test', phone: '+254700000001', engagement: 'own_terms', preferred_terms: 'Weekends off' }).select('id').single()
  const clientApps = await a.client.from('job_applications').select('id').eq('id', app.data?.id)
  check("clients cannot read others' applications", (clientApps.data ?? []).length === 0)
  const adminApps = await admin.client.from('job_applications').select('id').eq('id', app.data?.id)
  check('admin reads applications', adminApps.data?.length === 1, adminApps.error?.message)
  const signed = await service.storage.from('applications').createSignedUploadUrl(`${agencyId}/${tag}/test.pdf`)
  const up = signed.data && await anon.storage.from('applications').uploadToSignedUrl(signed.data.path, signed.data.token, new Blob(['%PDF-1.4 test'], { type: 'application/pdf' }), { contentType: 'application/pdf' })
  check('applicant uploads via signed URL', !up?.error, up?.error?.message)
  const anonRead = await anon.storage.from('applications').download(`${agencyId}/${tag}/test.pdf`)
  check('public cannot read application files', Boolean(anonRead.error))
  const adminRead = await admin.client.storage.from('applications').download(`${agencyId}/${tag}/test.pdf`)
  check('admin reads application files', !adminRead.error, adminRead.error?.message)
  await service.storage.from('applications').remove([`${agencyId}/${tag}/test.pdf`])
  await service.from('vacancies').delete().in('id', [draft.data?.id, open.data?.id])
  await service.from('job_applications').delete().eq('id', app.data?.id)
} finally {
  for (const id of createdStaff) await service.from('staff_profiles').delete().eq('id', id)
  // Deleting a login keeps its client record (for signed contracts), so remove those first.
  if (created.length) await service.from('clients').delete().in('user_id', created)
  for (const id of created) await service.auth.admin.deleteUser(id)
  await service.from('audit_log').delete().gte('created_at', started)
  console.log(`\ncleaned up ${created.length} test users`)
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll RLS checks passed')
process.exit(failures ? 1 : 0)
