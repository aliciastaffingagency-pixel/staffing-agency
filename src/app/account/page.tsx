import type { Metadata } from 'next'
import { EmptyState, Panel } from '@/components/portal/portal-shell'
import { ButtonLink } from '@/components/ui/button'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'My account' }

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-gold-100 text-gold-700',
  matched: 'bg-navy-50 text-navy-600',
  contracted: 'bg-brand-50 text-brand-600',
  active: 'bg-emerald-50 text-emerald-700',
  completed: 'bg-navy-50 text-navy-500',
  cancelled: 'bg-red-50 text-red-600',
}

export default async function AccountHome() {
  const session = await requireRole('client')
  const supabase = await createClient()
  const { data: bookings } = await supabase
    .from('booking_requests')
    .select('id, status, created_at, notes, staff_categories(name)')
    .order('created_at', { ascending: false })

  const firstName = session.full_name?.split(' ')[0]

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-navy-800">
            Hello{firstName ? `, ${firstName}` : ''} <span className="font-script text-brand-500">welcome</span>
          </h1>
          <p className="mt-1 text-navy-500">Your requests, contracts and staff live here.</p>
        </div>
        <ButtonLink href="/services">Find staff</ButtonLink>
      </div>

      <Panel title="My requests & hires">
        {bookings?.length ? (
          <ul className="grid gap-3">
            {bookings.map((b) => (
              <li key={b.id} className="flex items-center justify-between gap-4 rounded-2xl bg-blush px-4 py-3">
                <span className="font-medium text-navy-700">{b.staff_categories?.name ?? 'Staff request'}</span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLE[b.status]}`}>{b.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>
            You haven&apos;t requested anyone yet. Browse our services to find vetted staff — booking online arrives very soon.
          </EmptyState>
        )}
      </Panel>
    </div>
  )
}
