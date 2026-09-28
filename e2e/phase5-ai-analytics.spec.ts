import { expect, test } from '@playwright/test'
import { service, users } from './helpers'

test.describe.configure({ mode: 'serial' })

test('smart match ranks the right person from a plain-language request', async ({ browser }) => {
  test.setTimeout(240_000)
  const { tag, agencyId } = users()
  const { data: cats } = await service.from('staff_categories').select('id, slug').eq('agency_id', agencyId).in('slug', ['nanny', 'driver'])
  const nanny = cats!.find((c) => c.slug === 'nanny')!.id
  const driver = cats!.find((c) => c.slug === 'driver')!.id
  const seeded = await service.from('staff_profiles').insert([
    { agency_id: agencyId, category_id: nanny, full_name: `Near Nanny ${tag}`, location_text: 'Kilimani', live_arrangement: 'live_in', month_rate: 14000, skills: ['Cooking', 'Childcare'], years_experience: 5 },
    { agency_id: agencyId, category_id: nanny, full_name: `Far Nanny ${tag}`, location_text: 'Thika', live_arrangement: 'live_out', month_rate: 25000, skills: ['Childcare'] },
    { agency_id: agencyId, category_id: driver, full_name: `Driver ${tag}`, location_text: 'Kilimani', live_arrangement: 'live_out', month_rate: 20000 },
  ], { defaultToNull: false })
  expect(seeded.error).toBeNull()

  const page = await browser.newPage()
  await page.goto('/match')
  await page.getByLabel('Describe who you need, in your own words').fill('Someone to cook and help with two toddlers, live-in, Kilimani, around 15,000')
  await page.getByRole('button', { name: 'Find my matches' }).click()
  // Other suites may add equally good candidates, so assert relative order, not absolute rank.
  const results = page.locator('ol > li')
  const near = results.filter({ hasText: `Near Nanny ${tag}` })
  await expect(near).toHaveCount(1, { timeout: 60_000 })
  await expect(near).toContainText(/near Kilimani/i)
  const names = await results.allInnerTexts()
  const nearRank = names.findIndex((t) => t.includes(`Near Nanny ${tag}`))
  const farRank = names.findIndex((t) => t.includes(`Far Nanny ${tag}`))
  expect(farRank === -1 || nearRank < farRank).toBe(true) // closer, live-in, in budget ranks higher
  await expect(page.getByText(`Driver ${tag}`)).toHaveCount(0) // wrong role never shown
  await expect(near.getByRole('link', { name: 'Request Near' })).toHaveAttribute('href', /\/book\?staff=/)
})

test('concierge answers from real facts and captures a callback lead', async ({ browser }) => {
  test.setTimeout(240_000)
  const { tag, agencyId } = users()
  const page = await browser.newPage()
  await page.goto('/')
  await page.getByRole('button', { name: 'Chat with our concierge' }).click()
  const chat = page.getByRole('dialog', { name: 'Alicia concierge chat' })
  await chat.getByRole('button', { name: 'How do replacements work?' }).click()
  await expect(chat.getByText(/replace|replacement/i).last()).toBeVisible({ timeout: 60_000 })
  await chat.getByLabel('Your message').fill(`Please call me, I am Wanjiku ${tag} on 0711 222 333, I need a nanny in Karen`)
  await chat.getByRole('button', { name: 'Send' }).click()
  await expect(chat.getByText(/call you|call back|callback|contact/i).last()).toBeVisible({ timeout: 60_000 })

  await expect
    .poll(async () => (await service.from('leads').select('phone, need').eq('agency_id', agencyId).ilike('need', `%${tag}%`)).data?.length ?? 0, { timeout: 30_000 })
    .toBe(1)

  const admin = await browser.newPage({ storageState: 'e2e/.auth/admin.json' })
  await admin.goto('/admin/leads')
  await expect(admin.getByText(`Wanjiku ${tag}`).first()).toBeVisible()
  await admin.locator('li', { hasText: `Wanjiku ${tag}` }).getByRole('button', { name: 'Mark contacted' }).click()
  await expect(admin.locator('li', { hasText: `Wanjiku ${tag}` }).getByRole('button', { name: 'Converted' })).toBeVisible()
  await service.from('leads').delete().ilike('need', `%${tag}%`)
})

test('analytics shows funnel, demand and unmet searches', async ({ browser }) => {
  const admin = await browser.newPage({ storageState: 'e2e/.auth/admin.json' })
  await admin.goto('/admin/analytics?range=30')
  await expect(admin.getByRole('heading', { name: 'Analytics' })).toBeVisible()
  for (const t of ['Conversion funnel', 'Fees received by month', 'Demand map', 'Demand by role', 'Searches that found nobody', 'Retention & churn']) {
    await expect(admin.getByRole('heading', { name: t })).toBeVisible()
  }
  await expect(admin.locator('.leaflet-container')).toBeVisible()
})
