import { existsSync } from 'node:fs'
import { service, users, USERS_FILE } from './helpers'

// Removes everything the tests created (rows are tagged with the run's tag).
export default async function globalTeardown() {
  if (!existsSync(USERS_FILE)) return
  const { tag, admin, client, agencyId } = users()
  const like = `%${tag}%`

  const { data: staff } = await service.from('staff_profiles').select('id').eq('agency_id', agencyId).ilike('full_name', like)
  const staffIds = (staff ?? []).map((s) => s.id)
  const { data: bookings } = await service.from('booking_requests').select('id').eq('client_id', client.clientId)
  const bookingIds = (bookings ?? []).map((b) => b.id)
  if (bookingIds.length) {
    const { data: contracts } = await service.from('contracts').select('id').in('booking_request_id', bookingIds)
    const contractIds = (contracts ?? []).map((c) => c.id)
    if (contractIds.length) {
      await service.from('payments').delete().in('contract_id', contractIds)
      await service.from('ratings').delete().in('contract_id', contractIds)
      await service.from('contracts').delete().in('id', contractIds)
    }
  }
  await service.from('ratings').delete().eq('client_id', client.clientId)
  await service.from('job_applications').delete().eq('agency_id', agencyId).ilike('full_name', like)
  await service.from('vacancies').delete().eq('agency_id', agencyId).ilike('title', like)
  await service.auth.admin.deleteUser(client.id) // cascades client rows, bookings, threads
  if (staffIds.length) await service.from('staff_profiles').delete().in('id', staffIds)
  await service.from('staff_categories').delete().eq('agency_id', agencyId).ilike('name', like)
  await service.auth.admin.deleteUser(admin.id)
  // Any other accounts a test created for this run (e.g. a second client).
  const { data: all } = await service.auth.admin.listUsers({ perPage: 1000 })
  for (const u of all?.users ?? []) if (u.email?.endsWith(`-${tag}@example.test`)) await service.auth.admin.deleteUser(u.id)
  console.log(`e2e cleanup done for run ${tag}`)
}
