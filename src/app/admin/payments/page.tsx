import type { Metadata } from 'next'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { EmptyState, PageHeader, Panel, StatCard, StatusPill } from '@/components/portal/portal-shell'
import { requireRole } from '@/lib/auth'
import { mpesaMode, paystackEnabled } from '@/lib/payments'
import { createClient } from '@/lib/supabase/server'
import { formatDate, formatDateTime, formatKes } from '@/lib/utils'

export const metadata: Metadata = { title: 'Payments' }

export default async function PaymentsPage() {
  const session = await requireRole('super_admin')
  const supabase = await createClient()
  const [{ data: contracts }, { data: payments }] = await Promise.all([
    supabase
      .from('contracts')
      .select('id, status, amount_due, client_signed_at, booking_request_id, booking_requests(clients(name), staff_profiles(full_name))')
      .eq('agency_id', session.agency_id)
      .in('status', ['sent', 'client_signed', 'fully_signed', 'active', 'ended']),
    supabase
      .from('payments')
      .select('id, contract_id, amount, method, status, mpesa_receipt, card_ref, payer_phone, paid_at, created_at, contracts(booking_request_id, booking_requests(clients(name)))')
      .eq('agency_id', session.agency_id)
      .order('created_at', { ascending: false })
      .limit(300),
  ])

  const paidBy = new Map<string, number>()
  for (const p of payments ?? []) if (p.status === 'paid') paidBy.set(p.contract_id, (paidBy.get(p.contract_id) ?? 0) + Number(p.amount))

  // Invoiced = contracts the client has signed (fee is due from that point).
  const invoiced = (contracts ?? []).filter((c) => c.client_signed_at)
  const totalDue = invoiced.reduce((s, c) => s + Number(c.amount_due ?? 0), 0)
  const totalPaid = [...paidBy.values()].reduce((s, v) => s + v, 0)
  const outstanding = invoiced
    .map((c) => ({ ...c, balance: Math.max(0, Number(c.amount_due ?? 0) - (paidBy.get(c.id) ?? 0)) }))
    .filter((c) => c.balance > 0)
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const thisMonth = (payments ?? []).filter((p) => p.status === 'paid' && p.paid_at && p.paid_at >= monthStart).reduce((s, p) => s + Number(p.amount), 0)
  const awaitingSignature = (contracts ?? []).filter((c) => c.status === 'sent').reduce((s, c) => s + Number(c.amount_due ?? 0), 0)

  return (
    <div className="grid gap-8">
      <PageHeader title="Payments" description="What clients owe the agency, what's been paid, and what's still outstanding." />

      {(!mpesaMode() || !paystackEnabled()) && (
        <p className="flex items-start gap-2 rounded-2xl bg-gold-100/70 px-4 py-3 text-sm text-navy-700">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold-700" />
          <span>
            {!mpesaMode() && 'M-Pesa STK Push is not connected yet (add the Daraja keys). '}
            {!paystackEnabled() && 'Card payments are not connected yet (add a Paystack key). '}
            Until then, clients see instructions to pay manually, and you record the payment on the booking.
          </span>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Outstanding" value={formatKes(outstanding.reduce((s, c) => s + c.balance, 0))!} hint={`${outstanding.length} unpaid invoice${outstanding.length === 1 ? '' : 's'}`} />
        <StatCard label="Received this month" value={formatKes(thisMonth)!} />
        <StatCard label="Received all time" value={formatKes(totalPaid)!} hint={`of ${formatKes(totalDue)} invoiced`} />
        <StatCard label="Awaiting signature" value={formatKes(awaitingSignature)!} hint="Contracts sent, not yet signed" />
      </div>

      <Panel title="Outstanding invoices">
        {outstanding.length ? (
          <ul className="grid gap-2">
            {outstanding.map((c) => (
              <li key={c.id}>
                <Link href={`/admin/bookings/${c.booking_request_id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-blush px-4 py-3 hover:bg-brand-50">
                  <span>
                    <span className="block font-semibold text-navy-800">{c.booking_requests?.clients?.name ?? 'Client'}</span>
                    <span className="text-xs text-navy-400">
                      {c.booking_requests?.staff_profiles?.full_name} · signed {formatDate(c.client_signed_at)}
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-bold text-navy-800">{formatKes(c.balance)}</span>
                    <span className="text-xs text-navy-400">of {formatKes(c.amount_due)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState>Nothing outstanding. 🎉</EmptyState>
        )}
      </Panel>

      <Panel title="All payments">
        {payments?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-navy-400">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Date</th>
                  <th className="py-2 pr-4 font-semibold">Client</th>
                  <th className="py-2 pr-4 font-semibold">Amount</th>
                  <th className="py-2 pr-4 font-semibold">Method</th>
                  <th className="py-2 pr-4 font-semibold">Reference</th>
                  <th className="py-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-50">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 pr-4 text-navy-500">{formatDateTime(p.paid_at ?? p.created_at)}</td>
                    <td className="py-2.5 pr-4">
                      <Link href={`/admin/bookings/${p.contracts?.booking_request_id}`} className="font-medium text-navy-800 hover:text-brand-600">
                        {p.contracts?.booking_requests?.clients?.name ?? 'Client'}
                      </Link>
                    </td>
                    <td className="py-2.5 pr-4 font-semibold text-navy-800">{formatKes(p.amount)}</td>
                    <td className="py-2.5 pr-4 uppercase text-navy-600">{p.method}</td>
                    <td className="py-2.5 pr-4 text-navy-500">{p.mpesa_receipt ?? p.card_ref ?? p.payer_phone ?? '—'}</td>
                    <td className="py-2.5"><StatusPill status={p.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState>No payments yet.</EmptyState>
        )}
      </Panel>
    </div>
  )
}
