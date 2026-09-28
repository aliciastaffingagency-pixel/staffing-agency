import type { Metadata } from 'next'
import { EmptyState, PageHeader } from '@/components/portal/portal-shell'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { ClientRow } from './client-row'

export const metadata: Metadata = { title: 'Client accounts' }

export default async function ClientsPage() {
  const session = await requireRole('super_admin')
  const supabase = await createClient()
  const { data: clients } = await supabase
    .from('clients')
    .select('id, name, email, phone, kind, location_text, created_at, deleted_at, user_id, booking_requests(id)')
    .eq('agency_id', session.agency_id)
    .order('created_at', { ascending: false })
    .limit(500)

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Client accounts"
        description="Everyone with a client account. Use Delete account to act on a deletion request you received by email, phone or WhatsApp. Clients can also delete their own account from their settings."
      />
      {clients?.length ? (
        <ul className="grid gap-3">
          {clients.map((c) => (
            <ClientRow
              key={c.id}
              client={{
                id: c.id,
                name: c.name ?? 'Client',
                detail: [c.phone, c.email, c.location_text].filter(Boolean).join(' · '),
                meta: `${c.kind} · joined ${formatDate(c.created_at)} · ${c.booking_requests.length} booking${c.booking_requests.length === 1 ? '' : 's'}`,
                deleted: Boolean(c.deleted_at || !c.user_id),
              }}
            />
          ))}
        </ul>
      ) : (
        <EmptyState>No client accounts yet.</EmptyState>
      )}
    </div>
  )
}
