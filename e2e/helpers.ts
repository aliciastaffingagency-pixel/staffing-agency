import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

config({ path: '.env.local', quiet: true })

export const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

export type E2EUsers = {
  tag: string
  agencyId: string
  admin: { id: string; email: string; password: string }
  client: { id: string; email: string; password: string; clientId: string }
}

export const USERS_FILE = 'e2e/.auth/users.json'
export const users = (): E2EUsers => JSON.parse(readFileSync(USERS_FILE, 'utf8'))
