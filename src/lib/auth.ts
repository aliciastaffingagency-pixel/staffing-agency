import 'server-only'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Enums } from '@/lib/supabase/database.types'

export type Role = Enums<'user_role'>

export const HOME_FOR_ROLE: Record<Role, string> = {
  super_admin: '/admin',
  staff: '/staff-portal',
  client: '/account',
}

export const getSession = cache(async () => {
  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  const userId = claims?.claims?.sub
  if (!userId) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, agency_id, role, full_name, email, phone')
    .eq('id', userId)
    .single()
  if (!profile) return null
  return profile
})

// Use in layouts/pages: signed-out users go to /login, wrong roles go home.
export async function requireRole(...roles: Role[]) {
  const session = await getSession()
  if (!session) redirect('/login')
  if (!roles.includes(session.role)) redirect(HOME_FOR_ROLE[session.role])
  return session
}
