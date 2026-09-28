import { expect, test } from '@playwright/test'
import { service, users } from './helpers'

test.describe.configure({ mode: 'serial' })

test('client rates, requests a replacement, chats live with the agency; review goes public after moderation', async ({ browser }) => {
  test.setTimeout(300_000)
  const { tag, agencyId, client } = users()

  // An active placement for our client (set up directly).
  const { data: cat } = await service.from('staff_categories').select('id').eq('agency_id', agencyId).eq('slug', 'cook-chef').single()
  const { data: staff } = await service.from('staff_profiles').insert({ agency_id: agencyId, category_id: cat!.id, full_name: `Joseph Kamau ${tag}`, availability: 'placed' }).select('id').single()
  const { data: booking } = await service
    .from('booking_requests')
    .insert({ agency_id: agencyId, client_id: client.clientId, staff_id: staff!.id, category_id: cat!.id, status: 'active', location_text: 'Karen' })
    .select('id')
    .single()
  await service.from('contracts').insert({
    agency_id: agencyId,
    booking_request_id: booking!.id,
    status: 'active',
    amount_due: 0,
    terms_json: { body: 'STAFF PLACEMENT AGREEMENT\n\nTest terms.', values: {}, defaults: {} },
    client_signature: 'E2E Client',
    client_signed_at: new Date().toISOString(),
    admin_signature: 'Owner',
    admin_signed_at: new Date().toISOString(),
  })

  // --- Client rates Joseph
  const cp = await browser.newPage({ storageState: 'e2e/.auth/client.json' })
  await cp.goto(`/account/bookings/${booking!.id}`)
  await cp.getByRole('button', { name: '5 stars' }).click()
  await cp.getByLabel('Your review (optional)').fill(`Joseph cooks wonderful meals ${tag}`)
  await cp.getByRole('button', { name: 'Submit review' }).click()
  await expect(cp.getByText('Your review will appear once the agency has checked it')).toBeVisible()

  // Review is not public until moderated.
  const visitor = await browser.newPage()
  await visitor.goto(`/staff/${staff!.id}`)
  await expect(visitor.getByText(`Joseph cooks wonderful meals ${tag}`)).toHaveCount(0)

  // --- Client requests a replacement → lands in a conversation
  await cp.reload()
  await cp.getByLabel('What do you need?').selectOption({ label: 'Request a replacement' })
  await cp.getByLabel('Message').fill('Joseph is relocating to Nakuru next month, please send a replacement.')
  await cp.getByRole('button', { name: 'Send to the agency' }).click()
  await cp.waitForURL(/\/account\/messages\/[0-9a-f-]{36}$/)
  await expect(cp.getByRole('heading', { name: 'Replacement request' })).toBeVisible()
  const threadUrl = cp.url()

  // --- Admin: moderation queue shows both; publish the review
  const ap = await browser.newPage({ storageState: 'e2e/.auth/admin.json' })
  await ap.goto('/admin/moderation')
  await expect(ap.getByText(`Joseph cooks wonderful meals ${tag}`)).toBeVisible()
  const review = ap.locator('li', { hasText: `Joseph cooks wonderful meals ${tag}` })
  await review.getByRole('button', { name: 'Publish' }).click()
  await expect(ap.getByText('Recently moderated')).toBeVisible()

  await visitor.reload()
  await expect(visitor.getByText(`Joseph cooks wonderful meals ${tag}`)).toBeVisible()
  await expect(visitor.getByText('5.0').first()).toBeVisible()

  // --- Admin replies; the client's open chat receives it live (no reload)
  await ap.goto('/admin/moderation')
  await ap.locator('a', { hasText: 'Replacement request' }).first().click()
  await ap.waitForURL(/\/admin\/messages\//)
  await expect(ap.getByText('relocating to Nakuru')).toBeVisible()
  await ap.getByLabel('Message').fill(`Noted! We will send you options this week ${tag}`)
  await ap.getByRole('button', { name: 'Send' }).click()
  await expect(ap.getByText(`We will send you options this week ${tag}`)).toBeVisible()
  await expect(cp.getByText(`We will send you options this week ${tag}`)).toBeVisible({ timeout: 30_000 })
  expect(cp.url()).toBe(threadUrl)

  // Client answers back; admin resolves.
  await cp.getByLabel('Message').fill('Thank you!')
  await cp.keyboard.press('Enter')
  await expect(ap.getByText('Thank you!')).toBeVisible({ timeout: 30_000 })
  await ap.getByRole('button', { name: 'Mark resolved' }).click()
  await expect(ap.getByRole('button', { name: 'Reopen' })).toBeVisible()
})

test('client adds staff already working for them; agency confirms; client can then rate', async ({ browser }) => {
  test.setTimeout(240_000)
  const { tag } = users()
  const cp = await browser.newPage({ storageState: 'e2e/.auth/client.json' })
  await cp.goto('/account/staff')
  await cp.getByLabel('Their full name').fill(`Jane Wambui ${tag}`)
  await cp.getByLabel('Their phone (optional)').fill('0722000111')
  await cp.getByLabel('Anything that helps us find them').fill('House help since January')
  await cp.getByRole('button', { name: 'Send to the agency' }).click()
  await expect(cp.getByText('We’ll check our records and confirm')).toBeVisible()

  const ap = await browser.newPage({ storageState: 'e2e/.auth/admin.json' })
  await ap.goto('/admin/moderation')
  const claim = ap.locator('li', { hasText: `Jane Wambui ${tag}` })
  await claim.getByLabel('Which staff member is this?').selectOption('new')
  await claim.getByLabel('Their category').selectOption({ label: 'House Help' })
  await claim.getByRole('button', { name: 'Confirm' }).click()
  // Handled claims leave the queue.
  await expect(ap.locator('li', { hasText: `Jane Wambui ${tag}` })).toHaveCount(0)

  await cp.reload()
  await expect(cp.getByText('confirmed', { exact: true })).toBeVisible()
  await cp.getByRole('button', { name: '4 stars' }).click()
  await cp.getByRole('button', { name: 'Submit review' }).click()
  await expect(cp.getByText('Your review will appear once the agency has checked it')).toBeVisible()
})
