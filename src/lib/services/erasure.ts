import 'server-only'
import { revalidatePath } from 'next/cache'
import { notify } from '@/lib/notify'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/database.types'

// Permanent deletion of people and their data, shared by the admin tools, the
// client's own "delete my account" (web + app) and the mobile API.
//
// What is deliberately kept: signed contracts and payment records (tax / legal
// retention, disclosed in the Privacy Policy). Everything else about the person
// is deleted, including uploaded files; audit-log entries keep the action
// history but lose the stored personal data.

type Admin = ReturnType<typeof createAdminClient>
type Result<T> = { error: string } | ({ error?: undefined } & T)

async function listFolder(admin: Admin, bucket: string, folder: string) {
  const { data } = await admin.storage.from(bucket).list(folder, { limit: 1000 })
  return (data ?? []).filter((f) => f.id).map((f) => `${folder}/${f.name}`) // folders have no id
}

async function removeFiles(admin: Admin, bucket: string, paths: (string | null | undefined)[]) {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))]
  if (!unique.length) return 0
  const { data, error } = await admin.storage.from(bucket).remove(unique)
  if (error) console.error(`storage cleanup (${bucket}) failed`, error.message)
  return data?.length ?? 0
}

type AuditTarget = { table: string; id: string }
type AuditRef = { table: string; key: string; value: string }

async function redactAudit(admin: Admin, targets: AuditTarget[], refs: AuditRef[], reason: string) {
  const { error } = await admin.rpc('redact_audit_entries', { p_targets: targets as unknown as Json, p_refs: refs as unknown as Json, p_reason: reason })
  if (error) console.error('audit redaction failed', error.message)
}

const photoPathFromUrl = (url: string | null) => (url?.includes('/staff-photos/') ? decodeURIComponent(url.split('/staff-photos/')[1]) : null)

// ---------------------------------------------------------------------------
// Staff member (admin action)
// ---------------------------------------------------------------------------
export async function deleteStaffMember(agencyId: string, staffId: string): Promise<Result<{ name: string; files: number; hadLogin: boolean }>> {
  const admin = createAdminClient()
  const { data: staff } = await admin.from('staff_profiles').select('id, agency_id, full_name, user_id, photo_url, id_doc_url').eq('id', staffId).maybeSingle()
  if (!staff || staff.agency_id !== agencyId) return { error: 'Staff profile not found.' }

  const { data: ongoing } = await admin.from('booking_requests').select('id').eq('staff_id', staffId).in('status', ['contracted', 'active']).limit(1)
  if (ongoing?.length) return { error: `${staff.full_name} is on a contracted or active placement. End it first, then delete the profile.` }

  // Bookings that were matched to this person go back to the queue; unsigned contracts naming them are withdrawn.
  const { data: matched } = await admin.from('booking_requests').select('id').eq('staff_id', staffId).eq('status', 'matched')
  const matchedIds = (matched ?? []).map((b) => b.id)
  if (matchedIds.length) {
    await admin.from('contracts').update({ status: 'cancelled' }).in('booking_request_id', matchedIds).is('client_signed_at', null)
    await admin.from('booking_requests').update({ status: 'pending' }).in('id', matchedIds)
  }

  const photos = [...(await listFolder(admin, 'staff-photos', `${agencyId}/${staffId}`)), photoPathFromUrl(staff.photo_url)]
  const docs = [...(await listFolder(admin, 'staff-docs', `${agencyId}/${staffId}`)), staff.id_doc_url]

  // Cascades: vetting checks, reviews. Links from bookings, claims, threads and applications are cleared.
  const { error } = await admin.from('staff_profiles').delete().eq('id', staffId)
  if (error) return { error: error.message }
  if (staff.user_id) await admin.auth.admin.deleteUser(staff.user_id)

  const files = (await removeFiles(admin, 'staff-photos', photos)) + (await removeFiles(admin, 'staff-docs', docs))
  await redactAudit(
    admin,
    [{ table: 'staff_profiles', id: staffId }, ...(staff.user_id ? [{ table: 'profiles', id: staff.user_id }] : [])],
    [
      { table: 'staff_vetting_checks', key: 'staff_id', value: staffId },
      { table: 'ratings', key: 'staff_id', value: staffId },
    ],
    'staff profile deleted',
  )
  return { name: staff.full_name, files, hadLogin: Boolean(staff.user_id) }
}

// ---------------------------------------------------------------------------
// Job application (admin action)
// ---------------------------------------------------------------------------
export async function deleteApplication(agencyId: string, applicationId: string): Promise<Result<{ name: string; files: number }>> {
  const admin = createAdminClient()
  const { data: app } = await admin.from('job_applications').select('id, agency_id, full_name, documents').eq('id', applicationId).maybeSingle()
  if (!app || app.agency_id !== agencyId) return { error: 'Application not found.' }
  const paths = ((Array.isArray(app.documents) ? app.documents : []) as { path?: string }[]).map((d) => d.path)
  const { error } = await admin.from('job_applications').delete().eq('id', applicationId)
  if (error) return { error: error.message }
  const files = await removeFiles(admin, 'applications', paths)
  await redactAudit(admin, [{ table: 'job_applications', id: applicationId }], [], 'application deleted')
  return { name: app.full_name, files }
}

// ---------------------------------------------------------------------------
// Client account (self-service on web/app, or admin on request)
// ---------------------------------------------------------------------------
export async function deleteClientAccount(userId: string, by: 'self' | 'admin'): Promise<Result<{ retainedContracts: number }>> {
  const admin = createAdminClient()
  const { data: profile } = await admin.from('profiles').select('id, role, email, phone, full_name, agency_id').eq('id', userId).maybeSingle()
  if (!profile) return { error: 'Account not found.' }
  if (profile.role !== 'client') return { error: 'Only client accounts can be deleted this way.' }

  const { data: clients } = await admin.from('clients').select('id').eq('user_id', userId)
  const refs: AuditRef[] = []
  let retainedContracts = 0
  let activePlacement = false

  for (const client of clients ?? []) {
    refs.push(
      { table: 'booking_requests', key: 'client_id', value: client.id },
      { table: 'existing_staff_claims', key: 'client_id', value: client.id },
      { table: 'ratings', key: 'client_id', value: client.id },
    )
    const { data: bookings } = await admin.from('booking_requests').select('id, status').eq('client_id', client.id)
    const bookingIds = (bookings ?? []).map((b) => b.id)
    const keep = new Set<string>()

    if (bookingIds.length) {
      const { data: contracts } = await admin.from('contracts').select('id, booking_request_id, client_signed_at').in('booking_request_id', bookingIds)
      const unsigned = (contracts ?? []).filter((c) => !c.client_signed_at).map((c) => c.id)
      if (unsigned.length) await admin.from('contracts').delete().in('id', unsigned)
      for (const c of contracts ?? []) if (c.client_signed_at) keep.add(c.booking_request_id)
      retainedContracts += (contracts ?? []).length - unsigned.length
      activePlacement ||= (bookings ?? []).some((b) => keep.has(b.id) && (b.status === 'active' || b.status === 'contracted'))
      const drop = bookingIds.filter((id) => !keep.has(id))
      if (drop.length) await admin.from('booking_requests').delete().in('id', drop)
    }

    await admin.from('message_threads').delete().eq('client_id', client.id) // messages cascade
    await admin.from('existing_staff_claims').delete().eq('client_id', client.id)
    await admin.from('ratings').delete().eq('client_id', client.id)

    if (keep.size) {
      // Signed contracts stay for legal/tax retention; the client record is anonymised.
      await admin
        .from('clients')
        .update({ name: 'Deleted client', phone: null, email: null, location_text: null, lat: null, lng: null, deleted_at: new Date().toISOString() })
        .eq('id', client.id)
    } else {
      await admin.from('clients').delete().eq('id', client.id)
    }
  }

  // Job applications sent while signed in, and callback requests with their contact details.
  const { data: apps } = await admin.from('job_applications').select('id, documents').eq('applicant_user_id', userId)
  for (const app of apps ?? []) {
    await admin.from('job_applications').delete().eq('id', app.id)
    await removeFiles(admin, 'applications', ((Array.isArray(app.documents) ? app.documents : []) as { path?: string }[]).map((d) => d.path))
  }
  const quote = (v: string) => `"${v.replace(/["\\]/g, '')}"`
  const contacts = [profile.email && `email.eq.${quote(profile.email)}`, profile.phone && `phone.eq.${quote(profile.phone)}`].filter(Boolean).join(',')
  if (contacts) await admin.from('leads').delete().eq('agency_id', profile.agency_id).or(contacts)

  // The login itself: profile, notifications and push tokens cascade; client rows detach.
  const { error } = await admin.auth.admin.deleteUser(userId)
  if (error) return { error: error.message }
  await redactAudit(admin, [{ table: 'profiles', id: userId }, ...(apps ?? []).map((a) => ({ table: 'job_applications', id: a.id }))], refs, by === 'self' ? 'account deleted by user' : 'account deleted on request')
  revalidatePath('/', 'layout') // their reviews leave the cached public staff pages now, not at the next refresh

  if (activePlacement) {
    await notify({
      agencyId: profile.agency_id,
      role: 'super_admin',
      type: 'booking_update',
      message: 'A client with an ongoing placement deleted their account. Their signed contract is kept; please follow up on the placement.',
      link: '/admin/bookings?tab=active',
    })
  }
  return { retainedContracts }
}
