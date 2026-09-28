'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Cookie, X } from 'lucide-react'

const KEY = 'alicia-cookie-notice'

// We only use essential cookies, so this is a notice (not a consent wall). It sits in the page
// flow at the top, so it never covers buttons or forms. If non-essential cookies are ever added,
// replace this with a consent choice before loading them.
export function CookieNotice() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let seen = true
    try {
      seen = window.localStorage.getItem(KEY) === '1'
    } catch {
      // Storage blocked: keep the notice hidden rather than showing it on every page.
    }
    if (!seen) {
      const t = window.setTimeout(() => setShow(true), 0)
      return () => window.clearTimeout(t)
    }
  }, [])

  if (!show) return null
  const dismiss = () => {
    try {
      window.localStorage.setItem(KEY, '1')
    } catch {
      // ignore
    }
    setShow(false)
  }

  return (
    <div role="region" aria-label="Cookie notice" className="bg-navy-900 text-white/85">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 text-xs sm:px-6 sm:text-sm">
        <Cookie className="size-4 shrink-0 text-gold-300" aria-hidden="true" />
        <p className="flex-1">
          We use only essential cookies, to keep you signed in. No advertising or tracking.{' '}
          <Link href="/cookies" className="font-semibold text-gold-300 underline-offset-2 hover:underline">
            Cookie policy
          </Link>
        </p>
        <button type="button" onClick={dismiss} className="inline-flex items-center gap-1 rounded-full bg-white/10 px-3 py-1 font-semibold hover:bg-white/20">
          OK <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}
