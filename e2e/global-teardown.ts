import pg from 'pg'
import { service, users } from './helpers'

// Removes everything e2e runs create. Test data is always tagged with a run tag of a digit,
// a letter a-f and four hex chars ("Grace Wanjiru 3fa9c1", "e2e-client-3fa9c1@example.test").
// Real names and messages never contain such a token, so this can safely sweep leftovers from
// ANY earlier run too — e.g. one whose teardown was interrupted by a network error.
const TAG = '[0-9][a-f][0-9a-f]{4}'
const TAGGED = ` ${TAG}$`

async function step(name: string, fn: () => PromiseLike<unknown>) {
  try {
    const res = (await fn()) as { error?: { message: string } | null } | undefined
    if (res?.error) console.warn(`teardown ${name}: ${res.error.message}`)
  } catch (e) {
    console.warn(`teardown ${name}:`, e instanceof Error ? e.message : e)
  }
}

// Activity-log entries written during this run about records that no longer exist, i.e. the test
// data removed above. Entries about records that still exist are kept, so real activity is never lost.
async function purgeActivityLog(since: string) {
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await db.connect()
  try {
    const { rows } = await db.query<{ t: string }>('select distinct target_table as t from public.audit_log where created_at >= $1', [since])
    for (const { t } of rows) {
      if (!/^[a-z_]+$/.test(t)) continue
      await db.query(
        `delete from public.audit_log a where a.created_at >= $1 and a.target_table = $2
           and not exists (select 1 from public.${t} x where x.id::text = a.target_id)`,
        [since, t],
      )
    }
  } finally {
    await db.end()
  }
}

export default async function globalTeardown() {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 })
  const testUsers = (data?.users ?? []).filter((u) => /^e2e-.+@example\.test$/.test(u.email ?? ''))
  const userIds = testUsers.map((u) => u.id)

  // Uploaded files belonging to test records (removed from storage before their rows go).
  const files: Record<string, string[]> = { 'staff-photos': [], 'staff-docs': [], applications: [], contracts: [] }
  const { data: testStaff } = await service.from('staff_profiles').select('photo_url, id_doc_url').filter('full_name', 'match', TAGGED)
  for (const s of testStaff ?? []) {
    if (s.photo_url?.includes('/staff-photos/')) files['staff-photos'].push(s.photo_url.split('/staff-photos/')[1])
    if (s.id_doc_url) files['staff-docs'].push(s.id_doc_url)
  }
  const { data: testApps } = await service.from('job_applications').select('documents').filter('full_name', 'match', TAGGED)
  for (const a of testApps ?? []) for (const d of (a.documents as { path?: string }[]) ?? []) if (d.path) files.applications.push(d.path)

  // Test client records: those of test logins, plus any without a login (a login's deletion keeps its
  // client record when there are signed contracts): found by their tagged name or tagged bookings.
  const clientIds = new Set<string>()
  if (userIds.length) for (const c of (await service.from('clients').select('id').in('user_id', userIds)).data ?? []) clientIds.add(c.id)
  for (const c of (await service.from('clients').select('id').is('user_id', null).filter('name', 'match', TAGGED)).data ?? []) clientIds.add(c.id)
  const { data: taggedBookings } = await service.from('booking_requests').select('client_id, clients!inner(user_id)').filter('notes', 'match', TAGGED).is('clients.user_id', null)
  for (const b of taggedBookings ?? []) clientIds.add(b.client_id)

  // Contracts block booking deletion (ON DELETE RESTRICT), so clear them and their payments first.
  const ids = [...clientIds]
  if (ids.length) {
    const { data: bookings } = await service.from('booking_requests').select('id').in('client_id', ids)
    const bookingIds = (bookings ?? []).map((b) => b.id)
    if (bookingIds.length) {
      const { data: contracts } = await service.from('contracts').select('id, pdf_url').in('booking_request_id', bookingIds)
      const contractIds = (contracts ?? []).map((c) => c.id)
      for (const c of contracts ?? []) if (c.pdf_url) files.contracts.push(c.pdf_url)
      if (contractIds.length) {
        await step('payments', () => service.from('payments').delete().in('contract_id', contractIds))
        await step('ratings', () => service.from('ratings').delete().in('contract_id', contractIds))
        await step('contracts', () => service.from('contracts').delete().in('id', contractIds))
      }
    }
    await step('clients', () => service.from('clients').delete().in('id', ids)) // cascades bookings, threads, claims, ratings
  }

  for (const u of testUsers) await step(`user ${u.email}`, () => service.auth.admin.deleteUser(u.id)) // cascades profile, notifications, push tokens

  for (const [bucket, paths] of Object.entries(files)) if (paths.length) await step(`files ${bucket}`, () => service.storage.from(bucket).remove(paths))
  await step('notifications', () => service.from('notifications').delete().filter('message', 'imatch', `(\\s|SIM)${TAG}(\\W|$)`))
  await step('search log', () => service.from('match_queries').delete().filter('query', 'imatch', ` ref ${TAG}$`))
  await step('applications', () => service.from('job_applications').delete().filter('full_name', 'match', TAGGED))
  await step('vacancies', () => service.from('vacancies').delete().filter('title', 'match', TAGGED))
  await step('staff', () => service.from('staff_profiles').delete().filter('full_name', 'match', TAGGED))
  await step('categories', () => service.from('staff_categories').delete().filter('name', 'match', TAGGED))

  let startedAt: string | undefined
  try {
    startedAt = users().startedAt
  } catch {
    // Setup never got far enough to record the run; nothing of this run is in the log.
  }
  if (startedAt) await step('activity log', () => purgeActivityLog(startedAt))
  console.log(`e2e cleanup done (${testUsers.length} test accounts removed)`)
}
