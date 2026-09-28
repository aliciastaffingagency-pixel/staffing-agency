import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { EmptyState, Panel, StatusPill } from '@/components/portal/portal-shell'
import { ButtonLink } from '@/components/ui/button'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'

export const metadata: Metadata = { title: 'My account' }

// What the client should do next for a booking, if anything.
function nextStep(b: { status: string; contracts: { status: string }[] }) {
  const c = b.contracts.find((x) => x.status !== 'cancelled' && x.status !== 'ended')
  if (c?.status === 'sent') return 'Contract ready: review & sign'
  if (c && ['client_signed', 'fully_signed'].includes(c.status)) return 'Pay the agency fee'
  if (b.status === 'pending') return 'We’re finding your match'
  if (b.status === 'matched') return 'Contract on its way'
  if (b.status === 'active') return 'Active placement'
  return null
}

export default async function AccountHome() {
  const session = await requireRole('client')
  const supabase = await createClient()
  const { data: bookings } = await supabase
    .from('booking_requests')
    .select('id, status, created_at, location_text, staff_categories(name), staff_profiles(full_name), contracts(status)')
    .order('created_at', { ascending: false })

  const firstName = session.full_name?.split(' ')[0]
  const actionable = (bookings ?? []).filter((b) => {
    const s = nextStep(b)
    return s === 'Contract ready: review & sign' || s === 'Pay the agency fee'
  })

  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-navy-800">
            Hello{firstName ? `, ${firstName}` : ''} <span className="font-script text-brand-500">welcome</span>
          </h1>
          <p className="mt-1 text-navy-500">Your requests, contracts and staff live here.</p>
        </div>
        <ButtonLink href="/book">Request staff</ButtonLink>
      </div>

      {actionable.length > 0 && (
        <div className="grid gap-3">
          {actionable.map((b) => (
            <Link key={b.id} href={`/account/bookings/${b.id}`} className="flex items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-5 text-white shadow-lift">
              <span>
                <span className="block text-sm text-white/80">{b.staff_profiles?.full_name ?? b.staff_categories?.name}</span>
                <span className="text-lg font-bold">{nextStep(b)}</span>
              </span>
              <ArrowRight className="size-6" />
            </Link>
          ))}
        </div>
      )}

      <Panel title="My requests & hires">
        {bookings?.length ? (
          <ul className="grid gap-3">
            {bookings.map((b) => (
              <li key={b.id}>
                <Link href={`/account/bookings/${b.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-blush px-4 py-3 hover:bg-brand-50">
                  <span className="min-w-0">
                    <span className="block font-medium text-navy-700">
                      {b.staff_categories?.name ?? 'Staff request'}
                      {b.staff_profiles?.full_name && <span className="text-navy-500"> · {b.staff_profiles.full_name}</span>}
                    </span>
                    <span className="block text-xs text-navy-400">
                      {b.location_text} · {formatDate(b.created_at)}
                      {nextStep(b) && <span className="font-semibold text-brand-600"> · {nextStep(b)}</span>}
                    </span>
                  </span>
                  <StatusPill status={b.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>
            You haven&apos;t requested anyone yet.{' '}
            <Link href="/staff" className="font-semibold text-brand-600 hover:underline">Browse vetted staff</Link> or{' '}
            <Link href="/book" className="font-semibold text-brand-600 hover:underline">tell us who you need</Link>.
          </EmptyState>
        )}
      </Panel>
    </div>
  )
}
