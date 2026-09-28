import { PortalShell } from '@/components/portal/portal-shell'
import { requireRole } from '@/lib/auth'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('super_admin')
  return (
    <PortalShell
      title="Admin"
      userName={session.full_name ?? session.email ?? 'Admin'}
      roleLabel="Agency owner"
      links={[
        { href: '/admin', label: 'Overview' },
        { href: '/', label: 'View website' },
      ]}
    >
      {children}
    </PortalShell>
  )
}
