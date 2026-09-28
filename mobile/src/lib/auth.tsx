import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useState } from 'react'
import { registerForPush } from './push'
import { supabase, type Database } from './supabase'

type Profile = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'agency_id' | 'role' | 'full_name' | 'email' | 'phone'>

type AuthState = { ready: boolean; session: Session | null; profile: Profile | null; signOut: () => Promise<void> }

const AuthContext = createContext<AuthState>({ ready: false, session: null, profile: null, signOut: async () => {} })

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [loadedProfile, setProfile] = useState<Profile | null>(null)
  // Only the signed-in user's profile counts; a stale one from a previous session is ignored.
  const profile = session && loadedProfile?.id === session.user.id ? loadedProfile : null

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => setSession(next))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    supabase
      .from('profiles')
      .select('id, agency_id, role, full_name, email, phone')
      .eq('id', session.user.id)
      .single()
      .then(({ data }) => setProfile(data))
    registerForPush().catch(() => {}) // best effort; the app works without push
  }, [session])

  return (
    <AuthContext.Provider value={{ ready, session, profile, signOut: async () => void (await supabase.auth.signOut()) }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
