import type { Metadata } from 'next'
import { getSession } from '@/lib/auth'
import { ResetGate } from './reset-gate'

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false } }

// Reached from the reset email. The link usually carries the session in the URL fragment,
// which only the browser can read, so the gate decides on the client.
export default async function ResetPasswordPage() {
  const session = await getSession()
  return <ResetGate signedInAs={session?.email ?? null} />
}
