// Creates the client login that Google Play (and Apple) reviewers use to test the app, or gives an
// existing one a new password. It is confirmed straight away, so no email is needed.
//
//   node scripts/create-review-account.mjs              # <agency email with +playreview>, e.g. you+playreview@gmail.com
//   node scripts/create-review-account.mjs someone@example.com
//
// The password is printed once and never saved. Paste both into Play Console → App content →
// App access. Delete the account from Admin → Client accounts once the app is approved.
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'

config({ path: '.env.local', quiet: true })
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const slug = process.env.NEXT_PUBLIC_AGENCY_SLUG ?? 'alicia'

const { data: agency, error: agencyError } = await db.from('agencies').select('email, phone').eq('slug', slug).single()
if (agencyError) throw new Error(`agency: ${agencyError.message}`)
// Plus-addressing keeps any email to the reviewer account in the agency's own inbox.
const email = (process.argv[2] ?? agency.email?.replace('@', '+playreview@') ?? '').trim().toLowerCase()
if (!/^\S+@\S+\.\S+$/.test(email)) {
  console.error('Pass an email address: node scripts/create-review-account.mjs reviewer@example.com')
  process.exit(1)
}
const password = `Review-${randomBytes(9).toString('base64url')}`

const { data: list } = await db.auth.admin.listUsers({ perPage: 1000 })
const existing = list.users.find((u) => u.email === email)
if (existing) {
  const { data: profile } = await db.from('profiles').select('role').eq('id', existing.id).single()
  if (profile?.role !== 'client') throw new Error(`${email} is a ${profile?.role ?? 'unknown'} account; only client accounts can be used for review.`)
  const { error } = await db.auth.admin.updateUserById(existing.id, { password })
  if (error) throw error
} else {
  const { error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    // Notifications (SMS/WhatsApp) for this account go to the agency's own phone.
    user_metadata: { full_name: 'App Review', phone: agency.phone ?? undefined, client_kind: 'household', agency_slug: slug, terms_accepted: 'true' },
  })
  if (error) throw error
}

console.log(`\nReviewer login ${existing ? 'updated' : 'created'}. Paste into Play Console → App content → App access:\n`)
console.log(`  Email:     ${email}`)
console.log(`  Password:  ${password}\n`)
console.log('It is a normal client account. Delete it in Admin → Client accounts when the review is done.')
