// Creates (or promotes) the agency owner's super_admin account.
// Usage: node scripts/create-admin.mjs <email> [agency_slug]
// Prints a one-time password for new accounts — change it after first login.
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'

config({ path: '.env.local' })

const email = process.argv[2]
const agencySlug = process.argv[3] ?? process.env.NEXT_PUBLIC_AGENCY_SLUG ?? 'alicia'
if (!email) {
  console.error('Usage: node scripts/create-admin.mjs <email> [agency_slug]')
  process.exit(1)
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
)

const { data: agency, error: agencyError } = await supabase
  .from('agencies').select('id, name').eq('slug', agencySlug).single()
if (agencyError) throw agencyError

let userId
let password
const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
if (listError) throw listError
const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())

if (existing) {
  userId = existing.id
} else {
  password = randomBytes(12).toString('base64url')
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `${agency.name} Admin`, agency_slug: agencySlug },
  })
  if (error) throw error
  userId = data.user.id
}

const { error: roleError } = await supabase
  .from('profiles').update({ role: 'super_admin', agency_id: agency.id }).eq('id', userId)
if (roleError) throw roleError

// The owner is not a client of their own agency.
await supabase.from('clients').delete().eq('user_id', userId)

console.log(`super_admin ready: ${email} (${agency.name})`)
if (password) console.log(`one-time password: ${password}`)
