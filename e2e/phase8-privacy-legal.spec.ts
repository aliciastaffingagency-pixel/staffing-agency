import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { service, users } from './helpers'

test.describe.configure({ mode: 'serial' })

const anon = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } })

// A throwaway client login (teardown removes any e2e-…@example.test account).
async function makeClient(label: string, tag: string, meta: Record<string, string> = {}) {
  const email = `e2e-${label}-${tag}@example.test`
  const password = randomBytes(12).toString('base64url')
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `E2E ${label} ${tag}`, agency_slug: 'alicia', phone: '+254711000111', ...meta },
  })
  if (error) throw error
  const { data: c } = await service.from('clients').select('id').eq('user_id', data.user.id).single()
  return { id: data.user.id, email, password, clientId: c!.id }
}

const signedContract = (agencyId: string, bookingId: string) => {
  const now = new Date().toISOString()
  return {
    agency_id: agencyId,
    booking_request_id: bookingId,
    status: 'ended' as const,
    amount_due: 5000,
    terms_json: { body: 'STAFF PLACEMENT AGREEMENT\n\nTest terms.', values: {}, defaults: {} },
    client_signature: 'E2E Client',
    client_signed_at: now,
    admin_signature: 'Owner',
    admin_signed_at: now,
    ended_at: now,
  }
}

test('legal pages are linked from the footer; the cookie notice stays dismissed', async ({ page }) => {
  await page.goto('/')
  const notice = page.getByRole('region', { name: 'Cookie notice' })
  await expect(notice).toBeVisible()
  await expect(notice.getByRole('link', { name: 'Cookie policy' })).toHaveAttribute('href', '/cookies')
  await notice.getByRole('button', { name: 'OK' }).click()
  await expect(notice).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('alicia-cookie-notice'))).toBe('1')

  for (const [link, path, heading] of [
    ['Privacy Policy', '/privacy', 'Privacy Policy'],
    ['Terms of Service', '/terms', 'Terms of Service'],
    ['Cookie Policy', '/cookies', 'Cookie Policy'],
    ['Refund Policy', '/refunds', 'Refund & Cancellation Policy'],
    ['Delete your account', '/delete-account', 'Delete your Alicia Staffing account'],
  ]) {
    await page.goto('/')
    await page.locator('footer').getByRole('link', { name: link, exact: true }).click()
    await page.waitForURL((u) => u.pathname === path) // first visit compiles the page in dev
    await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible()
  }
  // Dismissed once, gone for good.
  await expect(notice).toHaveCount(0)
})

test('sign-up asks for agreement to the Terms and Privacy Policy, and the account records it', async ({ page }) => {
  const { tag, client } = users()
  await page.goto('/signup')
  await expect(page.getByLabel(/I agree to the Terms of Service and Privacy Policy/)).toHaveAttribute('required', '')
  await expect(page.getByRole('link', { name: 'Terms of Service' })).toHaveAttribute('href', '/terms')
  await expect(page.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy')

  // The website and the app send terms_accepted; the sign-up trigger stores when.
  const agreed = await makeClient('terms', tag, { terms_accepted: 'true' })
  expect((await service.from('profiles').select('terms_accepted_at').eq('id', agreed.id).single()).data!.terms_accepted_at).not.toBeNull()
  expect((await service.from('profiles').select('terms_accepted_at').eq('id', client.id).single()).data!.terms_accepted_at).toBeNull()
})

test('forgot password gives the same answer whether or not an account exists', async ({ page }) => {
  const { tag } = users()
  await page.goto('/login')
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await page.waitForURL('**/forgot-password')
  // No account → Supabase sends nothing, and the page must not reveal that.
  await page.getByLabel('Email').fill(`nobody-${tag}@example.test`)
  await page.getByRole('button', { name: 'Email me a reset link' }).click()
  await expect(page.getByText(`If an account exists for nobody-${tag}@example.test`)).toBeVisible()
})

test('a reset link works in any browser, even when it lands on the home page', async ({ browser }) => {
  const { tag } = users()
  const person = await makeClient('reset', tag)
  const page = await browser.newPage()

  await page.goto('/reset-password')
  await expect(page.getByRole('heading', { name: 'This link has expired' })).toBeVisible()
  await page.goto('/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')
  await expect(page.getByRole('heading', { name: 'This link has expired' })).toBeVisible()

  // What Supabase appends to the link: the session in the URL fragment. The admin API issues the
  // same recovery token as the email, without sending one.
  const { data: link, error } = await service.auth.admin.generateLink({ type: 'recovery', email: person.email })
  expect(error).toBeNull()
  const { data: verified } = await anon().auth.verifyOtp({ token_hash: link.properties!.hashed_token, type: 'recovery' })
  const s = verified.session!
  const fragment = new URLSearchParams({ access_token: s.access_token, refresh_token: s.refresh_token, expires_in: String(s.expires_in), token_type: 'bearer', type: 'recovery' })
  await page.goto(`/#${fragment}`) // Supabase's fallback when the link's target isn't on its allow list
  await page.waitForURL((u) => u.pathname === '/reset-password')
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
  await expect(page.getByText(`For ${person.email}.`)).toBeVisible()
  await expect.poll(() => page.url()).not.toContain('access_token')

  await page.getByLabel('New password').fill('first-choice-123')
  await page.getByLabel('Type it again').fill('second-choice-123')
  await page.getByRole('button', { name: 'Save new password' }).click()
  await expect(page.getByText("The two passwords don't match")).toBeVisible()

  const newPassword = `New-${tag}-${randomBytes(4).toString('hex')}`
  await page.getByLabel('New password').fill(newPassword)
  await page.getByLabel('Type it again').fill(newPassword)
  await page.getByRole('button', { name: 'Save new password' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/reset-password'))
  expect((await anon().auth.signInWithPassword({ email: person.email, password: newPassword })).error).toBeNull()
  expect((await anon().auth.signInWithPassword({ email: person.email, password: person.password })).error).not.toBeNull()
})

test('admin deletes a staff member: profile, checks, files and their details in the activity log', async ({ browser }) => {
  const { tag, agencyId, admin: adminUser } = users()
  const { data: cat } = await service.from('staff_categories').select('id').eq('agency_id', agencyId).eq('slug', 'gardener').single()
  const name = `John Mutua ${tag}`
  const { data: staff, error } = await service
    .from('staff_profiles')
    .insert({ agency_id: agencyId, category_id: cat!.id, full_name: name, location_text: 'Runda', publish_consent_at: new Date().toISOString() })
    .select('id')
    .single()
  expect(error).toBeNull()
  const folder = `${agencyId}/${staff!.id}`
  expect((await service.storage.from('staff-photos').upload(`${folder}/photo.jpg`, readFileSync('e2e/fixtures/photo.jpg'), { contentType: 'image/jpeg' })).error).toBeNull()
  expect((await service.storage.from('staff-docs').upload(`${folder}/id.pdf`, readFileSync('e2e/fixtures/id.pdf'), { contentType: 'application/pdf' })).error).toBeNull()
  const photoUrl = service.storage.from('staff-photos').getPublicUrl(`${folder}/photo.jpg`).data.publicUrl
  await service.from('staff_profiles').update({ photo_url: photoUrl, id_doc_url: `${folder}/id.pdf` }).eq('id', staff!.id)
  await service.from('staff_vetting_checks').insert({ agency_id: agencyId, staff_id: staff!.id, check_type: 'id_verification', notes: `ID seen ${tag}`, confirmed_by: adminUser.id })

  const visitor = await browser.newPage()
  expect((await visitor.goto(`/staff/${staff!.id}`))!.status()).toBe(200)

  const admin = await browser.newPage({ storageState: 'e2e/.auth/admin.json' })
  await admin.goto(`/admin/staff/${staff!.id}`)
  const form = admin.locator('form', { hasText: 'Delete this staff member' })
  const button = form.getByRole('button', { name: 'Delete permanently' })
  await expect(button).toBeDisabled()
  await form.getByLabel(/to confirm/).fill(name)
  await button.click()
  await admin.waitForURL(/\/admin\/staff\?deleted=/)
  await expect(admin.getByText(`${name} was deleted, along with their files and personal data.`)).toBeVisible()

  expect((await service.from('staff_profiles').select('id').eq('id', staff!.id)).data).toHaveLength(0)
  expect((await service.from('staff_vetting_checks').select('id').eq('staff_id', staff!.id)).data).toHaveLength(0)
  expect((await service.storage.from('staff-photos').list(folder)).data ?? []).toHaveLength(0)
  expect((await service.storage.from('staff-docs').list(folder)).data ?? []).toHaveLength(0)
  // The log keeps that changes happened, not who they were about.
  const { data: audit } = await service.from('audit_log').select('previous_value, new_value').eq('target_table', 'staff_profiles').eq('target_id', staff!.id)
  expect(audit!.length).toBeGreaterThan(0)
  expect(JSON.stringify(audit)).not.toContain(name)
  expect((await visitor.goto(`/staff/${staff!.id}`))!.status()).toBe(404)
})

test('admin deletes a job application and its documents', async ({ browser }) => {
  const { tag, agencyId } = users()
  const path = `${agencyId}/${randomUUID()}/id.pdf`
  expect((await service.storage.from('applications').upload(path, readFileSync('e2e/fixtures/id.pdf'), { contentType: 'application/pdf' })).error).toBeNull()
  const name = `Ann Njeri ${tag}`
  const { data: app } = await service
    .from('job_applications')
    .insert({ agency_id: agencyId, full_name: name, phone: '+254700000002', engagement: 'join_agency', documents: [{ label: 'National ID', path, name: 'id.pdf', size: 1000 }] })
    .select('id')
    .single()

  const admin = await browser.newPage({ storageState: 'e2e/.auth/admin.json' })
  await admin.goto(`/admin/applications/${app!.id}`)
  const form = admin.locator('form', { hasText: 'Delete this application' })
  await form.getByLabel(/to confirm/).fill('DELETE')
  await form.getByRole('button', { name: 'Delete application' }).click()
  await admin.waitForURL(/\/admin\/applications\?deleted=/)
  await expect(admin.getByText(`The application from ${name} and its documents were deleted.`)).toBeVisible()
  expect((await service.from('job_applications').select('id').eq('id', app!.id)).data).toHaveLength(0)
  expect((await service.storage.from('applications').download(path)).error).not.toBeNull()
})

test('client downloads their data, then deletes their account; signed contracts stay, without their details', async ({ browser }) => {
  // ~20 database round trips plus first-visit page compiles: slow against the dev server from a local machine.
  test.setTimeout(300_000)
  const { tag, agencyId } = users()
  const person = await makeClient('keeper', tag)
  const { data: cat } = await service.from('staff_categories').select('id').eq('agency_id', agencyId).eq('slug', 'driver').single()
  const { data: past } = await service
    .from('booking_requests')
    .insert({ agency_id: agencyId, client_id: person.clientId, category_id: cat!.id, status: 'completed', location_text: 'Karen', notes: `Past placement ${tag}` })
    .select('id')
    .single()
  const { data: contract } = await service.from('contracts').insert(signedContract(agencyId, past!.id)).select('id').single()
  await service.from('payments').insert({ agency_id: agencyId, contract_id: contract!.id, amount: 5000, method: 'mpesa', mpesa_receipt: `SIM${tag.toUpperCase()}K`, status: 'paid', paid_at: new Date().toISOString() })
  const { data: open } = await service
    .from('booking_requests')
    .insert({ agency_id: agencyId, client_id: person.clientId, category_id: cat!.id, location_text: 'Karen', notes: `Open request ${tag}` })
    .select('id')
    .single()

  const page = await browser.newPage()
  await page.goto('/login')
  await page.getByLabel('Email').fill(person.email)
  await page.getByLabel('Password').fill(person.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))

  // Right of access: a JSON copy of everything about them.
  await page.goto('/account/settings')
  await expect(page.getByRole('link', { name: /Download my data/ })).toHaveAttribute('href', '/account/export')
  const exported = await page.request.get('/account/export')
  expect(exported.status()).toBe(200)
  expect(exported.headers()['content-disposition']).toMatch(/^attachment; filename="alicia-my-data-/)
  const data = await exported.json()
  expect(data.profile.email).toBe(person.email)
  expect(data.booking_requests).toHaveLength(2)
  expect(data.contracts).toHaveLength(1)
  expect(data.payments).toHaveLength(1)

  const form = page.locator('form', { hasText: 'Delete my account' })
  await form.getByLabel(/to confirm/).fill('DELETE')
  await form.getByRole('button', { name: 'Delete my account' }).click()
  await page.waitForURL('**/account-deleted', { timeout: 240_000 })
  await expect(page.getByRole('heading', { name: 'Your account has been deleted' })).toBeVisible()

  expect((await service.auth.admin.getUserById(person.id)).data.user).toBeNull()
  expect((await service.from('profiles').select('id').eq('id', person.id)).data).toHaveLength(0)
  expect((await service.from('booking_requests').select('id').eq('id', open!.id)).data).toHaveLength(0)
  const { data: kept } = await service.from('clients').select('user_id, name, email, phone, deleted_at').eq('id', person.clientId).single()
  expect(kept).toMatchObject({ user_id: null, name: 'Deleted client', email: null, phone: null })
  expect(kept!.deleted_at).not.toBeNull()
  expect((await service.from('contracts').select('id').eq('id', contract!.id)).data).toHaveLength(1)
  expect((await service.from('payments').select('id').eq('contract_id', contract!.id)).data).toHaveLength(1)

  // Clean up the retained records now (teardown would also find them through the tagged booking).
  await service.from('payments').delete().eq('contract_id', contract!.id)
  await service.from('contracts').delete().eq('id', contract!.id)
  await service.from('clients').delete().eq('id', person.clientId)
})

test('app: account deletion needs confirmation and removes everything about the client', async ({ request }) => {
  test.setTimeout(300_000)
  const { tag, agencyId, admin } = users()
  const person = await makeClient('leaver', tag)
  const { data: cat } = await service.from('staff_categories').select('id').eq('agency_id', agencyId).eq('slug', 'house-help').single()
  const { data: booking } = await service
    .from('booking_requests')
    .insert({ agency_id: agencyId, client_id: person.clientId, category_id: cat!.id, location_text: 'Westlands', notes: `From the app ${tag}` })
    .select('id')
    .single()
  const { data: thread } = await service.from('message_threads').insert({ agency_id: agencyId, client_id: person.clientId, subject: 'Hello', kind: 'general' }).select('id').single()
  await service.from('messages').insert({ thread_id: thread!.id, sender_id: person.id, sender_role: 'client', body: `Hi ${tag}` })

  const { data: login } = await anon().auth.signInWithPassword({ email: person.email, password: person.password })
  const auth = { Authorization: `Bearer ${login.session!.access_token}` }
  expect((await request.post('/api/mobile/push-token', { headers: auth, data: { token: `ExponentPushToken[leaver-${tag}]`, platform: 'android' } })).status()).toBe(200)

  const refused = await request.post('/api/mobile/delete-account', { headers: auth, data: { confirm: 'yes' } })
  expect(refused.status()).toBe(400)
  expect((await refused.json()).error).toBe('Type DELETE to confirm.')

  // Staff and admin logins can't be deleted from the app.
  const { data: adminLogin } = await anon().auth.signInWithPassword({ email: admin.email, password: admin.password })
  const notClient = await request.post('/api/mobile/delete-account', { headers: { Authorization: `Bearer ${adminLogin.session!.access_token}` }, data: { confirm: 'DELETE' } })
  expect(notClient.status()).toBe(403)

  const res = await request.post('/api/mobile/delete-account', { headers: auth, data: { confirm: 'DELETE' } })
  expect(res.status()).toBe(200)
  expect(await res.json()).toMatchObject({ retainedContracts: 0 })

  expect((await service.auth.admin.getUserById(person.id)).data.user).toBeNull()
  expect((await service.from('clients').select('id').eq('id', person.clientId)).data).toHaveLength(0)
  expect((await service.from('booking_requests').select('id').eq('id', booking!.id)).data).toHaveLength(0)
  expect((await service.from('message_threads').select('id').eq('id', thread!.id)).data).toHaveLength(0)
  expect((await service.from('push_tokens').select('token').like('token', `%leaver-${tag}%`)).data).toHaveLength(0)
  // Their still-unexpired session no longer works.
  expect((await request.post('/api/mobile/bookings', { headers: auth, data: {} })).status()).toBe(401)
})

test('admin deletes a client account on request', async ({ browser }) => {
  test.setTimeout(300_000)
  const { tag } = users()
  const person = await makeClient('request', tag)
  const admin = await browser.newPage({ storageState: 'e2e/.auth/admin.json' })
  await admin.goto('/admin/clients')
  const row = admin.locator('li', { hasText: `E2E request ${tag}` })
  await row.getByRole('button', { name: 'Delete account' }).click()
  const form = row.locator('form', { hasText: `Delete E2E request ${tag}'s account` })
  await form.getByLabel(/to confirm/).fill('DELETE')
  await form.getByRole('button', { name: 'Delete account' }).click()
  await expect(admin.locator('li', { hasText: `E2E request ${tag}` })).toHaveCount(0)
  expect((await service.auth.admin.getUserById(person.id)).data.user).toBeNull()
  expect((await service.from('clients').select('id').eq('id', person.clientId)).data).toHaveLength(0)
})
