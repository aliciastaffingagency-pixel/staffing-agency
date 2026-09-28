import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'
import type { Ctx } from '@/lib/services/client-ops'

// Mobile app requests carry the user's Supabase access token as a Bearer token.
// The returned client acts as that user, so RLS applies exactly as on the web.
export async function apiContext(request: Request): Promise<Ctx | null> {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return null
  const supabase = createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data } = await supabase.auth.getClaims(token)
  const userId = data?.claims?.sub
  if (!userId) return null
  const { data: profile } = await supabase.from('profiles').select('id, agency_id, role, full_name, email, phone').eq('id', userId).single()
  return profile ? { supabase, session: profile } : null
}
