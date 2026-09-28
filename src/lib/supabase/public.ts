import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Cookie-free client for PUBLIC data (anon role, so RLS returns only public rows).
// Pages that fetch only through this client can be pre-rendered and served from
// the CDN instead of being rebuilt on every request.
export function createPublicClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
}
