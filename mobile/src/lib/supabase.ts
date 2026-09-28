import 'expo-sqlite/localStorage/install'
import { createClient } from '@supabase/supabase-js'
import { AppState } from 'react-native'
// Type-only import from the web app: erased at build time, so Metro never bundles it.
import type { Database } from '../../../src/lib/supabase/database.types'

export type { Database }

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

// Same Supabase project and RLS policies as the website.
export const supabase = createClient<Database>(supabaseUrl, supabaseKey, {
  auth: {
    storage: localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // native apps have no URL to read a session from
  },
})

// Refresh tokens only while the app is in the foreground (Supabase's mobile recommendation).
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh()
  else supabase.auth.stopAutoRefresh()
})
