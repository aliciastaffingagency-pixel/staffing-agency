import { PortalShell } from '@/components/portal/portal-shell'
import { Notifications } from '@/components/portal/notifications'
import { requireRole } from '@/lib/auth'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('client')
  return (
    <PortalShell
      title="My account"
      userName={session.full_name ?? session.email ?? 'My account'}
      headerExtra={<Notifications />}
      roleLabel="Client"
      links={[
        { href: '/account', label: 'My hires' },
        { href: '/book', label: 'Request staff' },
        { href: '/staff', label: 'Browse staff' },
      ]}
    >
      {children}
    </PortalShell>
  )
}
