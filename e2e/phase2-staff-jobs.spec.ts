import { expect, test } from '@playwright/test'
import { users } from './helpers'

test.describe.configure({ mode: 'serial' })

test('admin adds a category and it goes live on the website', async ({ browser }) => {
  const { tag } = users()
  const admin = await browser.newPage({ storageState: 'e2e/.auth/admin.json' })
  await admin.goto('/admin/categories')
  const form = admin.locator('form', { has: admin.getByRole('button', { name: 'Add category' }) })
  await form.getByLabel('Name').fill(`Pool Cleaner ${tag}`)
  await form.getByLabel('Short description').fill('Keeps your pool sparkling.')
  await form.getByRole('button', { name: 'Dog' }).click()
  await form.getByRole('button', { name: 'Add category' }).click()
  await expect(admin.getByText(`“Pool Cleaner ${tag}” added`)).toBeVisible()

  const visitor = await browser.newPage()
  await visitor.goto('/services')
  await expect(visitor.getByRole('heading', { name: `Pool Cleaner ${tag}` })).toBeVisible()
})

test('admin creates a staff profile with photo; vetting checks unlock badges', async ({ browser }) => {
  const { tag } = users()
  const admin = await browser.newPage({ storageState: 'e2e/.auth/admin.json' })
  await admin.goto('/admin/staff/new')
  await admin.getByLabel('Full name').fill(`Grace Wanjiru ${tag}`)
  await admin.getByLabel('Category').selectOption({ label: 'Nanny' })
  await admin.locator('input[type=file]').first().setInputFiles('e2e/fixtures/photo.jpg')
  await expect(admin.getByText('Photo uploaded')).toBeVisible()
  await admin.getByLabel('Bio').fill('Warm, patient nanny with 6 years caring for toddlers.')
  await admin.getByLabel('Skills').fill('Childcare, Cooking, First aid')
  await admin.getByLabel('Languages').fill('English, Kiswahili')
  await admin.getByLabel('Live-in / live-out').selectOption('live_in')
  await admin.getByLabel('Years of experience').fill('6')
  await admin.getByLabel('Monthly rate (KES)').fill('14,000')
  await admin.getByLabel('Home area').fill('Kilimani')
  // Publishing needs the person's recorded agreement (Kenya Data Protection Act).
  await admin.getByRole('button', { name: 'Create profile' }).click()
  await expect(admin.getByText('Tick "has agreed to be shown publicly" before publishing')).toBeVisible()
  await admin.getByLabel('Has agreed to be shown publicly').check()
  await admin.getByRole('button', { name: 'Create profile' }).click()
  await admin.waitForURL(/\/admin\/staff\/[0-9a-f-]{36}/)
  await expect(admin.getByText('Profile created.')).toBeVisible()

  // Confirm ID verification → Verified badge.
  await admin.getByRole('button', { name: /ID verified in person/ }).click()
  await admin.getByRole('button', { name: 'Mark passed' }).click()
  await expect(admin.getByText('Vetting record updated')).toBeVisible()

  const staffId = admin.url().split('/').pop()!.split('?')[0]
  const visitor = await browser.newPage()
  await visitor.goto(`/staff/${staffId}`)
  await expect(visitor.getByRole('heading', { name: `Grace Wanjiru ${tag}` })).toBeVisible()
  await expect(visitor.getByText('Verified', { exact: true })).toBeVisible()
  await expect(visitor.getByText('Trained', { exact: true })).toHaveCount(0)
  await expect(visitor.getByText(/Ksh\s14,000/).first()).toBeVisible()

  // Catalog filters: live-in + 10–15k band + area finds her; live-out does not.
  await visitor.goto('/staff?category=nanny&live=live_in&price=10-15&area=Kilimani')
  await expect(visitor.getByText(`Grace Wanjiru ${tag}`)).toBeVisible()
  await visitor.goto('/staff?category=nanny&live=live_out&area=Kilimani')
  await expect(visitor.getByText(`Grace Wanjiru ${tag}`)).toHaveCount(0)
})

test('owner posts a vacancy; applicant applies with documents; owner converts them to staff', async ({ browser }) => {
  const { tag } = users()
  const admin = await browser.newPage({ storageState: 'e2e/.auth/admin.json' })
  await admin.goto('/admin/jobs/new')
  await admin.getByLabel('Job title').fill(`Live-in Chef ${tag}`)
  await admin.getByLabel('Category').selectOption({ label: 'Cooking Assistant / Chef' })
  await admin.getByLabel('Job description').fill('Cook healthy family meals for a family of five in Karen.')
  await admin.getByLabel('Location').fill('Karen, Nairobi')
  await admin.getByLabel('Pay from (KES)').fill('18000')
  await admin.getByLabel('Pay up to (KES)').fill('25000')
  await admin.getByRole('button', { name: 'Remove CV / Résumé' }).click()
  await admin.getByRole('button', { name: 'Certificate of good conduct' }).click()
  await admin.getByRole('button', { name: 'Post vacancy' }).click()
  await admin.waitForURL(/\/admin\/jobs\/[0-9a-f-]{36}/)

  // Applicant (not signed in)
  const applicant = await browser.newPage()
  await applicant.goto('/jobs')
  await applicant.getByText(`Live-in Chef ${tag}`).click()
  await expect(applicant.getByText(/Ksh\s18,000 – Ksh\s25,000 \/ month/)).toBeVisible()
  await applicant.getByLabel('Full name').fill(`Peter Otieno ${tag}`)
  await applicant.getByLabel('Phone number').fill(`07${String(Date.now()).slice(-8)}`)
  await applicant.getByLabel('Where do you live?').fill('Kawangware')
  await applicant.getByLabel('Years of experience').fill('4')
  await applicant.getByLabel('Skills').fill('Baking, Continental cuisine')
  await applicant.getByText('Agree my own terms with the owner').click()
  await applicant.getByLabel('The terms you would prefer').fill('KES 22,000 per month, Sundays off, live-out.')

  // Submitting without the required documents is refused, and the typed fields survive.
  await applicant.getByLabel(/I confirm the information/).check()
  await applicant.getByRole('button', { name: 'Send my application' }).click()
  await expect(applicant.getByText('Please upload: National ID, Certificate of good conduct')).toBeVisible()
  await expect(applicant.getByLabel('Full name')).toHaveValue(`Peter Otieno ${tag}`)

  const slots = applicant.locator('li', { has: applicant.locator('input[type=file]') })
  await slots.filter({ hasText: 'National ID' }).locator('input[type=file]').setInputFiles('e2e/fixtures/id.pdf')
  await slots.filter({ hasText: 'Certificate of good conduct' }).locator('input[type=file]').setInputFiles('e2e/fixtures/photo.jpg')
  await expect(slots.filter({ hasText: 'id.pdf' })).toBeVisible()
  await expect(slots.filter({ hasText: 'photo.jpg' })).toBeVisible()
  await applicant.getByRole('button', { name: 'Send my application' }).click()
  await expect(applicant.getByText('Your application has been received')).toBeVisible()

  // Owner reviews
  await admin.goto('/admin/applications')
  await admin.getByRole('link', { name: `Peter Otieno ${tag}` }).click()
  await expect(admin.getByText('Agree my own terms with the owner')).toBeVisible()
  await expect(admin.getByText('Sundays off')).toBeVisible()
  await expect(admin.getByRole('link', { name: /National ID/ })).toBeVisible()
  // Private document opens through a short-lived signed link.
  const href = await admin.getByRole('link', { name: /National ID/ }).getAttribute('href')
  expect(href).toContain('/storage/v1/object/sign/applications/')
  expect((await admin.request.get(href!)).status()).toBe(200)

  await admin.getByRole('button', { name: 'Create staff profile' }).click()
  await admin.waitForURL(/\/admin\/staff\/[0-9a-f-]{36}\?created=1/)
  await expect(admin.getByLabel('Full name')).toHaveValue(`Peter Otieno ${tag}`)
  await expect(admin.getByRole('link', { name: 'Open ID document' })).toBeVisible()
})
