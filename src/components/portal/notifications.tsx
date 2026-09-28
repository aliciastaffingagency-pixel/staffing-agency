import { createClient } from '@/lib/supabase/server'
import { NotificationBell } from './notification-bell'

// Server wrapper: loads the latest notifications for the signed-in user.
export async function Notifications() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('notifications')
    .select('id, message, link, read, created_at')
    .order('created_at', { ascending: false })
    .limit(20)
  return <NotificationBell initial={data ?? []} />
}
