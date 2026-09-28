import { PortalShell } from '@/components/portal/portal-shell'
import { Notifications } from '@/components/portal/notifications'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole('client')
  const supabase = await createClient()
  const { data: threads } = await supabase.from('message_threads').select('last_message_at, client_last_read_at')
  const unread = (threads ?? []).filter((t) => t.last_message_at > t.client_last_read_at).length
  return (
    <PortalShell
      title="My account"
      userName={session.full_name ?? session.email ?? 'My account'}
      headerExtra={<Notifications />}
      roleLabel="Client"
      links={[
        { href: '/account', label: 'My hires' },
        { href: '/account/messages', label: 'Messages', count: unread },
        { href: '/account/staff', label: 'My staff' },
        { href: '/book', label: 'Request staff' },
        { href: '/staff', label: 'Browse staff' },
        { href: '/account/settings', label: 'Settings' },
      ]}
    >
      {children}
    </PortalShell>
  )
}
