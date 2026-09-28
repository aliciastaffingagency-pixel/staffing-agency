'use client'

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { ResetForm } from './reset-form'

type View = { state: 'checking' } | { state: 'ready'; email: string | null } | { state: 'expired' }

// Reset links arrive two ways:
//  - #access_token=…&type=recovery (emails sent by the website and the app): the browser signs in here.
//  - through /auth/callback, which has already signed the user in on the server (signedInAs).
export function ResetGate({ signedInAs }: { signedInAs: string | null }) {
  const [view, setView] = useState<View>({ state: 'checking' })
  // Read once: the effect below clears the address bar, and React may run it twice (development).
  const [fragment] = useState(() => (typeof window === 'undefined' ? '' : window.location.hash.slice(1)))

  useEffect(() => {
    let cancelled = false
    async function check(): Promise<View> {
      const params = new URLSearchParams(fragment)
      if (params.has('access_token') || params.has('error')) {
        // Keep the tokens out of the address bar and the browser history.
        window.history.replaceState(null, '', window.location.pathname)
      }
      const access_token = params.get('access_token')
      const refresh_token = params.get('refresh_token')
      if (access_token && refresh_token && params.get('type') === 'recovery') {
        const { data, error } = await createClient().auth.setSession({ access_token, refresh_token })
        return error || !data.user ? { state: 'expired' } : { state: 'ready', email: data.user.email ?? null }
      }
      if (params.has('error') || !signedInAs) return { state: 'expired' }
      return { state: 'ready', email: signedInAs }
    }
    check().then((next) => {
      if (!cancelled) setView(next)
    })
    return () => {
      cancelled = true
    }
  }, [fragment, signedInAs])

  if (view.state === 'checking') {
    return (
      <p className="flex items-center gap-2 text-navy-500">
        <Loader2 className="size-5 animate-spin" /> Checking your link…
      </p>
    )
  }
  if (view.state === 'expired') {
    return (
      <>
        <h1 className="text-3xl font-extrabold tracking-tight text-navy-800">This link has expired</h1>
        <p className="mt-2 text-navy-500">Reset links work once and only for a short time. Request a new one and use it straight away.</p>
        <ButtonLink href="/forgot-password" size="lg" className="mt-8 w-full">Send a new link</ButtonLink>
      </>
    )
  }
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight text-navy-800">Choose a new password</h1>
      <p className="mt-2 text-navy-500">
        {view.email ? <>For {view.email}. </> : null}You&apos;ll stay signed in on this device afterwards. If you use the
        Alicia Staffing app, log in there with the new password.
      </p>
      <div className="mt-8">
        <ResetForm />
      </div>
    </>
  )
}
