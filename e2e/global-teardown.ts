import { service } from './helpers'

// Removes everything e2e runs create. Test data is always tagged with a run tag of one digit
// plus five hex chars ("Grace Wanjiru 3fa9c1", "e2e-client-3fa9c1@example.test"). Real names
// never end in a word starting with a digit, so this can safely sweep leftovers from ANY earlier
// run too — e.g. one whose teardown was interrupted by a network error.
const TAGGED = ' [0-9][0-9a-f]{5}$'

async function step(name: string, fn: () => PromiseLike<unknown>) {
  try {
    const res = (await fn()) as { error?: { message: string } | null } | undefined
    if (res?.error) console.warn(`teardown ${name}: ${res.error.message}`)
  } catch (e) {
    console.warn(`teardown ${name}:`, e instanceof Error ? e.message : e)
  }
}

export default async function globalTeardown() {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 })
  const testUsers = (data?.users ?? []).filter((u) => /^e2e-.+@example\.test$/.test(u.email ?? ''))
  const userIds = testUsers.map((u) => u.id)

  // Contracts block booking deletion (ON DELETE RESTRICT), so clear them and their payments first.
  const { data: clients } = userIds.length ? await service.from('clients').select('id').in('user_id', userIds) : { data: [] }
  const clientIds = (clients ?? []).map((c) => c.id)
  if (clientIds.length) {
    const { data: bookings } = await service.from('booking_requests').select('id').in('client_id', clientIds)
    const bookingIds = (bookings ?? []).map((b) => b.id)
    if (bookingIds.length) {
      const { data: contracts } = await service.from('contracts').select('id').in('booking_request_id', bookingIds)
      const contractIds = (contracts ?? []).map((c) => c.id)
      if (contractIds.length) {
        await step('payments', () => service.from('payments').delete().in('contract_id', contractIds))
        await step('ratings', () => service.from('ratings').delete().in('contract_id', contractIds))
        await step('contracts', () => service.from('contracts').delete().in('id', contractIds))
      }
    }
    await step('client ratings', () => service.from('ratings').delete().in('client_id', clientIds))
  }

  for (const u of testUsers) await step(`user ${u.email}`, () => service.auth.admin.deleteUser(u.id)) // cascades clients, bookings, threads, tokens

  await step('applications', () => service.from('job_applications').delete().filter('full_name', 'match', TAGGED))
  await step('vacancies', () => service.from('vacancies').delete().filter('title', 'match', TAGGED))
  await step('staff', () => service.from('staff_profiles').delete().filter('full_name', 'match', TAGGED))
  await step('categories', () => service.from('staff_categories').delete().filter('name', 'match', TAGGED))
  console.log(`e2e cleanup done (${testUsers.length} test accounts removed)`)
}
