'use client'

import { useEffect, useState } from 'react'
import { ButtonLink } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'

// Signed-in state read in the browser, so public pages stay cacheable
// (the server never has to read the auth cookie to render them).
export function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false)
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)))
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)))
    return () => data.subscription.unsubscribe()
  }, [])
  return signedIn
}

export function HeaderAuth() {
  const signedIn = useSignedIn()
  if (signedIn) {
    return (
      <ButtonLink href="/dashboard" variant="navy" size="sm">
        My dashboard
      </ButtonLink>
    )
  }
  return (
    <>
      <ButtonLink href="/login" variant="ghost" size="sm">
        Log in
      </ButtonLink>
      <ButtonLink href="/signup" size="sm">
        Get started
      </ButtonLink>
    </>
  )
}
