import { PortalShell } from '@/components/portal/portal-shell'
import { Notifications } from '@/components/portal/notifications'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('super_admin')
  const supabase = await createClient()
  const head = { count: 'exact', head: true } as const
  const [apps, bookings, threads, reviews, claims, leads] = await Promise.all([
    supabase.from('job_applications').select('id', head).eq('agency_id', session.agency_id).eq('status', 'new'),
    supabase.from('booking_requests').select('id', head).eq('agency_id', session.agency_id).eq('status', 'pending'),
    supabase.from('message_threads').select('last_message_at, admin_last_read_at').eq('agency_id', session.agency_id).eq('status', 'open'),
    supabase.from('ratings').select('id', head).eq('agency_id', session.agency_id).is('moderated_at', null),
    supabase.from('existing_staff_claims').select('id', head).eq('agency_id', session.agency_id).eq('status', 'pending'),
    supabase.from('leads').select('id', head).eq('agency_id', session.agency_id).eq('status', 'new'),
  ])
  const unreadThreads = (threads.data ?? []).filter((t) => t.last_message_at > t.admin_last_read_at).length

  return (
    <PortalShell
      title="Admin"
      userName={session.full_name ?? session.email ?? 'Admin'}
      headerExtra={<Notifications />}
      roleLabel="Agency owner"
      layout="sidebar"
      links={[
        { href: '/admin', label: 'Overview' },
        { href: '/admin/bookings', label: 'Bookings', count: bookings.count ?? 0, group: 'Clients' },
        { href: '/admin/messages', label: 'Messages', count: unreadThreads, group: 'Clients' },
        { href: '/admin/moderation', label: 'Reviews & requests', count: (reviews.count ?? 0) + (claims.count ?? 0), group: 'Clients' },
        { href: '/admin/leads', label: 'Leads', count: leads.count ?? 0, group: 'Clients' },
        { href: '/admin/staff', label: 'Staff', group: 'Staffing' },
        { href: '/admin/categories', label: 'Categories', group: 'Staffing' },
        { href: '/admin/jobs', label: 'Vacancies', group: 'Staffing' },
        { href: '/admin/applications', label: 'Applications', count: apps.count ?? 0, group: 'Staffing' },
        { href: '/admin/payments', label: 'Payments', group: 'Business' },
        { href: '/admin/analytics', label: 'Analytics', group: 'Business' },
        { href: '/admin/settings', label: 'Settings', group: 'Business' },
      ]}
    >
      {children}
    </PortalShell>
  )
}
