import { chromium, type FullConfig } from '@playwright/test'
import pg from 'pg'
import { mkdirSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { service, USERS_FILE, type E2EUsers } from './helpers'

async function makeUser(label: string, tag: string) {
  const email = `e2e-${label}-${tag}@example.test`
  const password = randomBytes(12).toString('base64url')
  const { data, error } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `E2E ${label[0].toUpperCase()}${label.slice(1)} ${tag}`, agency_slug: 'alicia', phone: '+254711000111' },
  })
  if (error) throw error
  return { id: data.user.id, email, password }
}

async function login(baseURL: string, email: string, password: string, file: string) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ baseURL })
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 90_000 })
  await page.context().storageState({ path: file })
  await browser.close()
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL!
  // Fresh rate-limit windows so repeated local runs aren't throttled.
  const db = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
  await db.connect()
  await db.query('delete from private.rate_limits')
  await db.end()

  // Digit first, so teardown can recognise test data without touching real records.
  const tag = `${randomBytes(1)[0] % 10}${randomBytes(3).toString('hex').slice(0, 5)}`
  mkdirSync('e2e/.auth', { recursive: true })

  const admin = await makeUser('admin', tag)
  await service.from('profiles').update({ role: 'super_admin' }).eq('id', admin.id)
  await service.from('clients').delete().eq('user_id', admin.id)
  const client = await makeUser('client', tag)
  const { data: c } = await service.from('clients').select('id, agency_id').eq('user_id', client.id).single()
  await service.from('clients').update({ location_text: 'Kilimani, Nairobi' }).eq('id', c!.id)

  const users: E2EUsers = { tag, agencyId: c!.agency_id, admin, client: { ...client, clientId: c!.id } }
  writeFileSync(USERS_FILE, JSON.stringify(users, null, 2))

  await login(baseURL, admin.email, admin.password, 'e2e/.auth/admin.json')
  await login(baseURL, client.email, client.password, 'e2e/.auth/client.json')
}
