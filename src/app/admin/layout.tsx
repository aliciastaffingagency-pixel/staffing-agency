import { PortalShell } from '@/components/portal/portal-shell'
import { Notifications } from '@/components/portal/notifications'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('super_admin')
  const supabase = await createClient()
  const head = { count: 'exact', head: true } as const
  const [apps, bookings] = await Promise.all([
    supabase.from('job_applications').select('id', head).eq('agency_id', session.agency_id).eq('status', 'new'),
    supabase.from('booking_requests').select('id', head).eq('agency_id', session.agency_id).eq('status', 'pending'),
  ])

  return (
    <PortalShell
      title="Admin"
      userName={session.full_name ?? session.email ?? 'Admin'}
      headerExtra={<Notifications />}
      roleLabel="Agency owner"
      links={[
        { href: '/admin', label: 'Overview' },
        { href: '/admin/bookings', label: 'Bookings', count: bookings.count ?? 0 },
        { href: '/admin/payments', label: 'Payments' },
        { href: '/admin/staff', label: 'Staff' },
        { href: '/admin/categories', label: 'Categories' },
        { href: '/admin/jobs', label: 'Vacancies' },
        { href: '/admin/applications', label: 'Applications', count: apps.count ?? 0 },
        { href: '/admin/settings', label: 'Settings' },
      ]}
    >
      {children}
    </PortalShell>
  )
}
