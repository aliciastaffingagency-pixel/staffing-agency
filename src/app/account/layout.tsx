import { PortalShell } from '@/components/portal/portal-shell'
import { requireRole } from '@/lib/auth'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('client')
  return (
    <PortalShell
      title="My account"
      userName={session.full_name ?? session.email ?? 'My account'}
      roleLabel="Client"
      links={[
        { href: '/account', label: 'My hires' },
        { href: '/services', label: 'Browse staff' },
      ]}
    >
      {children}
    </PortalShell>
  )
}
