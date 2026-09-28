import { redirect } from 'next/navigation'
import { getSession, HOME_FOR_ROLE } from '@/lib/auth'

// Single post-login entry point: routes each role to its own area.
export default async function DashboardRedirect() {
  const session = await getSession()
  redirect(session ? HOME_FOR_ROLE[session.role] : '/login')
}
