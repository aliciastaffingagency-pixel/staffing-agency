'use client'

import { useEffect } from 'react'

// Email links from Supabase can carry a session in the URL fragment (#access_token=…&type=…).
// Supabase sends people to the site's home page when a link's target isn't on its allow list,
// so wherever one lands: password resets go on to the reset page, email confirmations to the
// login page, and any tokens are removed from the address bar.
export function AuthLinkHandler() {
  useEffect(() => {
    const { pathname, hash } = window.location
    if (!hash || pathname === '/reset-password') return
    const params = new URLSearchParams(hash.slice(1))
    const type = params.get('type')
    if (params.has('access_token') && type === 'recovery') {
      window.location.replace(`/reset-password${hash}`)
    } else if (params.has('access_token') && type === 'signup' && pathname !== '/login') {
      window.location.replace('/login?confirmed=1')
    } else if (params.has('error_description')) {
      window.location.replace(`/login?error=${encodeURIComponent('That link has expired or was already used. Please try again.')}`)
    } else if (params.has('access_token')) {
      window.history.replaceState(null, '', pathname + window.location.search)
    }
  }, [])
  return null
}
