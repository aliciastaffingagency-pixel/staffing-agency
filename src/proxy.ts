import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

export async function proxy(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  // Only where a signed-in session is read on the server. Public pages check sign-in in the
  // browser, so they can be served straight from the CDN without running this first.
  matcher: ['/admin/:path*', '/account/:path*', '/staff-portal/:path*', '/dashboard', '/book', '/reset-password'],
}
