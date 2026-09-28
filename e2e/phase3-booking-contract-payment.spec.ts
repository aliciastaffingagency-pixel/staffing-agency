import { expect, test } from '@playwright/test'
import { service, users } from './helpers'

test.describe.configure({ mode: 'serial' })

test('request → match → contract → sign → M-Pesa → countersign → active placement', async ({ browser, request }) => {
  test.setTimeout(300_000)
  const { tag, agencyId, client } = users()

  // A published staff member to book.
  const { data: nanny } = await service.from('staff_categories').select('id').eq('agency_id', agencyId).eq('slug', 'nanny').single()
  const { data: staff, error } = await service
    .from('staff_profiles')
    .insert({ agency_id: agencyId, category_id: nanny!.id, full_name: `Mary Achieng ${tag}`, month_rate: 16000, live_arrangement: 'live_in', location_text: 'Kilimani', publish_consent_at: new Date().toISOString() })
    .select('id')
    .single()
  expect(error).toBeNull()

  // --- Client requests her
  const cp = await browser.newPage({ storageState: 'e2e/.auth/client.json' })
  // From the service page: choosing the service lists the available people to pick from.
  await cp.goto('/services/nanny')
  await cp.getByRole('link', { name: 'Request a Nanny' }).click()
  await cp.waitForURL(/\/book\?category=nanny/)
  await expect(cp.getByText('Let the agency choose for me')).toBeVisible()
  await expect(cp.getByRole('radio', { name: /Let the agency choose/ })).toBeChecked()
  await cp.getByText(`Mary Achieng ${tag}`).click()
  await expect(cp.getByRole('radio', { name: new RegExp(`Mary Achieng ${tag}`) })).toBeChecked()
  // Switching service resets the choice and shows that service's people instead.
  await cp.getByLabel('What kind of help do you need?').selectOption({ label: 'Driver' })
  await expect(cp.getByText(`Mary Achieng ${tag}`)).toHaveCount(0)
  await cp.getByLabel('What kind of help do you need?').selectOption({ label: 'Nanny' })
  await cp.getByText(`Mary Achieng ${tag}`).click()
  await cp.getByLabel('Monthly budget (KES, optional)').fill('16000')
  await cp.getByLabel('Tell us about the job').fill('Two toddlers, Monday to Saturday.')
  await cp.getByRole('button', { name: 'Send request' }).click()
  await cp.waitForURL(/^[^?]*\/account\/bookings\/[0-9a-f-]{36}\?new=1$/)
  await expect(cp.getByText('Request sent!')).toBeVisible()
  const bookingId = cp.url().split('/').pop()!.split('?')[0]

  // --- Admin matches and sends the contract
  const ap = await browser.newPage({ storageState: 'e2e/.auth/admin.json' })
  await ap.goto(`/admin/bookings/${bookingId}`)
  await expect(ap.getByText('Two toddlers, Monday to Saturday.').first()).toBeVisible()
  await ap.getByRole('button', { name: 'Confirm match & notify client' }).click()
  await expect(ap.getByText(`Mary Achieng ${tag} assigned`)).toBeVisible()
  await ap.getByLabel('Agency fee due (KES)').fill('5000')
  await ap.getByRole('button', { name: 'Generate & send contract' }).click()
  await expect(ap.getByText('STAFF PLACEMENT AGREEMENT')).toBeVisible()

  // --- Client signs
  await cp.goto(`/account/bookings/${bookingId}`)
  await expect(cp.getByText(`The Agency places Mary Achieng ${tag}`)).toBeVisible()
  await expect(cp.getByText(/placement fee of Ksh\s5,000/)).toBeVisible()
  await cp.getByLabel(/I have read and agree/).check()
  await cp.getByLabel('Type your full name').fill(`E2E Client ${tag}`)
  await cp.getByRole('button', { name: 'Sign contract' }).click()
  // Signing swaps the form for the payment panel.
  await expect(cp.getByText('Pay Ksh', { exact: false })).toBeVisible()
  await expect(cp.locator("article").getByText(`E2E Client ${tag}`, { exact: true })).toBeVisible()

  // --- Client pays with (simulated) M-Pesa
  await cp.getByLabel('M-Pesa phone number').fill('0712345678')
  await cp.getByRole('button', { name: 'Pay with M-Pesa' }).click()
  await expect(cp.getByText('Waiting for M-Pesa confirmation')).toBeVisible()

  const { data: contract } = await service.from('contracts').select('id').eq('booking_request_id', bookingId).single()
  const { data: payment } = await service.from('payments').select('mpesa_checkout_request_id, amount, status').eq('contract_id', contract!.id).single()
  expect(payment!.status).toBe('processing')
  expect(Number(payment!.amount)).toBe(5000)

  const callback = (checkout: string, secret: string) =>
    request.post(`/api/payments/mpesa/callback?secret=${encodeURIComponent(secret)}`, {
      data: {
        Body: {
          stkCallback: {
            MerchantRequestID: 'm-1',
            CheckoutRequestID: checkout,
            ResultCode: 0,
            ResultDesc: 'The service request is processed successfully.',
            CallbackMetadata: { Item: [{ Name: 'Amount', Value: 5000 }, { Name: 'MpesaReceiptNumber', Value: `SIM${tag.toUpperCase()}` }, { Name: 'PhoneNumber', Value: 254712345678 }] },
          },
        },
      },
    })
  expect((await callback(payment!.mpesa_checkout_request_id!, 'wrong-secret')).status()).toBe(401)
  expect((await callback(payment!.mpesa_checkout_request_id!, process.env.MPESA_CALLBACK_SECRET!)).status()).toBe(200)
  // Safaricom retries must be harmless.
  expect((await callback(payment!.mpesa_checkout_request_id!, process.env.MPESA_CALLBACK_SECRET!)).status()).toBe(200)

  await cp.reload()
  await expect(cp.getByText(`SIM${tag.toUpperCase()}`)).toBeVisible()
  await expect(cp.getByRole('button', { name: 'Pay with M-Pesa' })).toHaveCount(0)

  // --- Admin countersigns → active, PDF generated
  await ap.reload()
  await ap.getByLabel('Type your full name to countersign').fill('Alicia Owner')
  await ap.getByRole('button', { name: 'Countersign for the agency' }).click()
  await expect(ap.locator('article').getByText('Alicia Owner')).toBeVisible({ timeout: 60_000 })
  await ap.reload()
  await expect(ap.getByText('active', { exact: true }).first()).toBeVisible()
  const pdfHref = await ap.getByRole('link', { name: 'PDF' }).getAttribute('href')
  const pdf = await ap.request.get(pdfHref!)
  expect(pdf.status()).toBe(200)
  expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-')

  const { data: placed } = await service.from('staff_profiles').select('availability').eq('id', staff!.id).single()
  expect(placed!.availability).toBe('placed')

  // --- Client sees the confirmed placement + notifications
  await cp.goto(`/account/bookings/${bookingId}`)
  await expect(cp.getByText('active', { exact: true }).first()).toBeVisible()
  await expect(cp.getByRole('link', { name: 'Download PDF' })).toBeVisible()
  await cp.getByRole('button', { name: /Notifications \(\d+ unread\)/ }).click()
  await expect(cp.getByText('Your placement is now active')).toBeVisible()

  // --- Payments dashboard reflects it; RLS keeps other clients out
  await ap.goto('/admin/payments')
  await expect(ap.getByText(`SIM${tag.toUpperCase()}`)).toBeVisible()
  const other = await service.auth.admin.createUser({ email: `e2e-other-${tag}@example.test`, password: `Pw-${tag}-123456`, email_confirm: true })
  const op = await browser.newPage()
  await op.goto('/login')
  await op.getByLabel('Email').fill(`e2e-other-${tag}@example.test`)
  await op.getByLabel('Password').fill(`Pw-${tag}-123456`)
  await op.getByRole('button', { name: 'Log in' }).click()
  await op.waitForURL('**/account')
  const res = await op.goto(`/account/bookings/${bookingId}`)
  expect(res!.status()).toBe(404)
  // Deleting a login leaves its client record (kept when there are signed contracts), so remove it first.
  await service.from('clients').delete().eq('user_id', other.data.user!.id)
  await service.auth.admin.deleteUser(other.data.user!.id)

  // --- Admin ends the placement → staff available again
  await ap.goto(`/admin/bookings/${bookingId}`)
  await ap.getByLabel('Reason').first().fill('Contract finished')
  await ap.getByRole('button', { name: 'End placement' }).click()
  await expect(ap.getByText('completed', { exact: true }).first()).toBeVisible()
  await expect
    .poll(async () => (await service.from('staff_profiles').select('availability').eq('id', staff!.id).single()).data?.availability)
    .toBe('available')
  void client
})
