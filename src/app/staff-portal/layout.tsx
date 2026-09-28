import { PortalShell } from '@/components/portal/portal-shell'
import { Notifications } from '@/components/portal/notifications'
import { requireRole } from '@/lib/auth'

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('staff')
  return (
    <PortalShell
      title="Staff portal"
      userName={session.full_name ?? session.email ?? 'Staff'}
      headerExtra={<Notifications />}
      roleLabel="Staff member"
      links={[{ href: '/staff-portal', label: 'My placements' }]}
    >
      {children}
    </PortalShell>
  )
}
