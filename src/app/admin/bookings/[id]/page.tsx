import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Download, Mail, Phone } from 'lucide-react'
import { ContractDocument } from '@/components/contracts/contract-document'
import { PageHeader, Panel, StatusPill } from '@/components/portal/portal-shell'
import { Button, ButtonLink } from '@/components/ui/button'
import { WhatsAppIcon } from '@/components/icons'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { AVAILABILITY_LABEL, formatDate, formatDateTime, formatKes, LIVE_LABEL } from '@/lib/utils'
import { cancelBooking, cancelContract, regeneratePdf } from '../actions'
import { AssignStaffForm, ContractForm, CountersignForm, EndPlacementForm, ManualPaymentForm } from './forms'

export const metadata: Metadata = { title: 'Booking' }

export default async function AdminBookingPage({ params }: PageProps<'/admin/bookings/[id]'>) {
  const session = await requireRole('super_admin')
  const { id } = await params
  const supabase = await createClient()

  const { data: b } = await supabase
    .from('booking_requests')
    .select('*, clients(id, name, phone, email, location_text, kind), staff_categories(id, name), staff_profiles(id, full_name, month_rate, day_rate, availability)')
    .eq('id', id)
    .eq('agency_id', session.agency_id)
    .maybeSingle()
  if (!b) notFound()

  const [{ data: candidates }, { data: contracts }] = await Promise.all([
    supabase
      .from('staff_profiles')
      .select('id, full_name, availability, location_text, month_rate, rating_avg, rating_count')
      .eq('agency_id', session.agency_id)
      .eq('is_active', true)
      .eq('category_id', b.category_id ?? '00000000-0000-0000-0000-000000000000')
      .order('availability')
      .order('rating_avg', { ascending: false }),
    supabase.from('contracts').select('*').eq('booking_request_id', id).order('created_at', { ascending: false }),
  ])
  const contract = contracts?.find((c) => c.status !== 'cancelled' && c.status !== 'ended') ?? contracts?.[0] ?? null
  const { data: payments } = contract
    ? await supabase.from('payments').select('*').eq('contract_id', contract.id).order('created_at', { ascending: false })
    : { data: [] }
  const paid = (payments ?? []).filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0)
  const outstanding = Math.max(0, Number(contract?.amount_due ?? 0) - paid)
  const { data: pdf } = contract?.pdf_url ? await supabase.storage.from('contracts').createSignedUrl(contract.pdf_url, 60 * 30) : { data: null }

  const client = b.clients
  const openContract = contract && !['cancelled', 'ended'].includes(contract.status)
  const canCancel = ['pending', 'matched', 'contracted'].includes(b.status) && contract?.status !== 'active'

  return (
    <div className="grid gap-6">
      <Link href="/admin/bookings" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-brand-600">
        <ArrowLeft className="size-4" /> All bookings
      </Link>
      <PageHeader
        title={`${b.staff_categories?.name ?? 'Staff'} for ${client?.name ?? 'client'}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusPill status={b.status} /> Requested {formatDateTime(b.created_at)}
          </span>
        }
        action={
          client?.phone && (
            <div className="flex flex-wrap gap-2">
              <ButtonLink href={`tel:${client.phone}`} variant="outline" size="sm"><Phone className="size-4" /> Call</ButtonLink>
              <ButtonLink href={`https://wa.me/${client.phone.replace(/^\+/, '')}`} target="_blank" variant="whatsapp" size="sm"><WhatsAppIcon className="size-4" /> WhatsApp</ButtonLink>
              {client.email && <ButtonLink href={`mailto:${client.email}`} variant="outline" size="sm"><Mail className="size-4" /> Email</ButtonLink>}
            </div>
          )
        }
      />

      <div className="grid items-start gap-6 xl:grid-cols-[1fr_400px]">
        <div className="grid gap-6">
          <Panel title="Request">
            <dl className="grid gap-4 text-sm sm:grid-cols-3">
              <Item label="Client">{client?.name} <span className="capitalize text-navy-400">({client?.kind})</span></Item>
              <Item label="Area">{b.location_text}</Item>
              <Item label="Start">{formatDate(b.start_date) || 'Flexible'}</Item>
              <Item label="Arrangement">{b.live_arrangement ? LIVE_LABEL[b.live_arrangement] : '—'}</Item>
              <Item label="Budget">{b.budget ? `${formatKes(b.budget)} / month` : '—'}</Item>
              <Item label="Phone">{client?.phone}</Item>
            </dl>
            {b.notes && <p className="mt-4 whitespace-pre-line rounded-2xl bg-blush p-4 text-sm leading-relaxed text-navy-700">{b.notes}</p>}
            {b.cancelled_reason && <p className="mt-4 text-sm text-red-600">Cancelled: {b.cancelled_reason}</p>}
          </Panel>

          {contract ? (
            <Panel
              title="Contract"
              action={
                <span className="flex items-center gap-2">
                  <StatusPill status={contract.status} />
                  {pdf?.signedUrl && (
                    <a href={pdf.signedUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
                      <Download className="size-4" /> PDF
                    </a>
                  )}
                </span>
              }
            >
              <ContractDocument
                terms={contract.terms_json}
                clientSignature={contract.client_signature}
                clientSignedAt={contract.client_signed_at}
                adminSignature={contract.admin_signature}
                adminSignedAt={contract.admin_signed_at}
                showIp={contract.client_ip as string | null}
              />
              <div className="mt-4 flex flex-wrap gap-2">
                {openContract && contract.status !== 'active' && (
                  <form action={cancelContract}>
                    <input type="hidden" name="contract_id" value={contract.id} />
                    <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50">Withdraw contract</Button>
                  </form>
                )}
                {contract.admin_signed_at && (
                  <form action={regeneratePdf}>
                    <input type="hidden" name="contract_id" value={contract.id} />
                    <Button variant="ghost" size="sm">Regenerate PDF</Button>
                  </form>
                )}
              </div>
            </Panel>
          ) : null}

          {b.staff_id && !openContract && ['matched', 'pending'].includes(b.status) && (
            <Panel title="Prepare the contract">
              <ContractForm
                bookingId={b.id}
                defaults={{
                  rate: b.staff_profiles?.month_rate ?? b.staff_profiles?.day_rate ?? null,
                  rate_period: b.staff_profiles?.month_rate ? 'month' : b.staff_profiles?.day_rate ? 'day' : 'month',
                  starts_on: b.start_date,
                  duties: b.notes,
                  live: b.live_arrangement ?? 'either',
                  fee: null,
                }}
              />
            </Panel>
          )}
        </div>

        <div className="grid gap-6 xl:sticky xl:top-24">
          <Panel title="Staff">
            {b.staff_profiles && (
              <p className="mb-4 text-sm text-navy-600">
                <Link href={`/admin/staff/${b.staff_profiles.id}`} className="font-semibold text-brand-600 hover:underline">{b.staff_profiles.full_name}</Link>
                {' · '}
                {AVAILABILITY_LABEL[b.staff_profiles.availability]}
              </p>
            )}
            {['pending', 'matched'].includes(b.status) ? (
              <AssignStaffForm
                bookingId={b.id}
                current={b.staff_id}
                confirmed={b.status === 'matched'}
                candidates={(candidates ?? []).map((c) => ({
                  id: c.id,
                  label: `${c.full_name} · ${AVAILABILITY_LABEL[c.availability]}${c.location_text ? ` · ${c.location_text}` : ''}${c.rating_count ? ` · ${Number(c.rating_avg).toFixed(1)}★` : ''}`,
                }))}
              />
            ) : (
              <p className="text-sm text-navy-400">Staff is locked once a contract is signed.</p>
            )}
          </Panel>

          {contract?.status === 'client_signed' && !contract.admin_signed_at && (
            <Panel title="Countersign">
              <CountersignForm contractId={contract.id} defaultName={session.full_name ?? ''} />
            </Panel>
          )}

          {contract && contract.status !== 'cancelled' && (
            <Panel title="Payment">
              <dl className="grid grid-cols-3 gap-2 text-center text-sm">
                <Money label="Due" value={Number(contract.amount_due ?? 0)} />
                <Money label="Paid" value={paid} />
                <Money label="Outstanding" value={outstanding} strong={outstanding > 0} />
              </dl>
              {payments?.length ? (
                <ul className="mt-4 grid gap-2 text-sm">
                  {payments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-blush px-3 py-2">
                      <span>
                        {formatKes(p.amount)} · <span className="uppercase">{p.method}</span>
                        {p.mpesa_receipt && <span className="text-navy-400"> · {p.mpesa_receipt}</span>}
                      </span>
                      <StatusPill status={p.status} />
                    </li>
                  ))}
                </ul>
              ) : null}
              {outstanding > 0 && ['client_signed', 'fully_signed', 'active'].includes(contract.status) && (
                <div className="mt-5 border-t border-dashed border-brand-100 pt-4">
                  <p className="mb-3 text-sm font-semibold text-navy-700">Received it another way? Record it:</p>
                  <ManualPaymentForm contractId={contract.id} outstanding={outstanding} />
                </div>
              )}
            </Panel>
          )}

          {contract?.status === 'active' && (
            <Panel title="End placement">
              <EndPlacementForm contractId={contract.id} />
            </Panel>
          )}

          {canCancel && (
            <form action={cancelBooking} className="grid gap-2 rounded-3xl border border-dashed border-red-200 p-4">
              <input type="hidden" name="booking_id" value={b.id} />
              <input name="reason" placeholder="Reason (shown to the client)" className="h-10 rounded-full border border-navy-100 px-4 text-sm" />
              <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50">Cancel booking</Button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wider text-navy-400">{label}</dt>
      <dd className="mt-1 text-navy-700">{children || '—'}</dd>
    </div>
  )
}

function Money({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`rounded-2xl px-2 py-3 ${strong ? 'bg-gold-100' : 'bg-blush'}`}>
      <dt className="text-xs text-navy-500">{label}</dt>
      <dd className="font-bold text-navy-800">{formatKes(value)}</dd>
    </div>
  )
}
