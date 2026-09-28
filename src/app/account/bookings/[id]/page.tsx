import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Check, Download, UserRound } from 'lucide-react'
import { ContractDocument } from '@/components/contracts/contract-document'
import { Panel, StatusPill } from '@/components/portal/portal-shell'
import { StaffBadges } from '@/components/staff/staff-card'
import { Button } from '@/components/ui/button'
import { FormAlert } from '@/components/ui/form'
import { formatPhone, getAgency } from '@/lib/agency'
import { requireRole } from '@/lib/auth'
import { mpesaMode, paystackEnabled } from '@/lib/payments'
import { createClient } from '@/lib/supabase/server'
import { cn, formatDate, formatKes, LIVE_LABEL } from '@/lib/utils'
import { cancelMyBooking } from '../../actions'
import { PayPanel, SignContractForm } from './client-forms'

export const metadata: Metadata = { title: 'My booking' }

// A prompt still waiting on the client's phone (M-Pesa times out after ~2 minutes).
function isRecent(ts: string, ms: number) {
  return Date.now() - new Date(ts).getTime() < ms
}

const STEPS = ['Requested', 'Matched', 'Signed', 'Paid', 'Active'] as const

export default async function ClientBookingPage({ params, searchParams }: PageProps<'/account/bookings/[id]'>) {
  const session = await requireRole('client')
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()

  const { data: b } = await supabase
    .from('booking_requests')
    .select('*, staff_categories(name), clients(phone)')
    .eq('id', id)
    .maybeSingle()
  if (!b) notFound()

  const [agency, { data: staff }, { data: contracts }] = await Promise.all([
    getAgency(),
    b.staff_id
      ? supabase.from('staff_catalog').select('id, full_name, photo_url, category_name, verified_badge, trained_badge, background_checked_badge, rating_avg, rating_count').eq('id', b.staff_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from('contracts').select('*').eq('booking_request_id', id).neq('status', 'cancelled').order('created_at', { ascending: false }),
  ])
  const contract = contracts?.[0] ?? null
  const { data: payments } = contract ? await supabase.from('payments').select('id, amount, method, status, mpesa_receipt, paid_at, created_at').eq('contract_id', contract.id).order('created_at', { ascending: false }) : { data: [] }
  const paid = (payments ?? []).filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0)
  const outstanding = Math.max(0, Number(contract?.amount_due ?? 0) - paid)
  const processing = (payments ?? []).some((p) => p.status === 'processing' && isRecent(p.created_at, 3 * 60_000))
  const { data: pdf } = contract?.pdf_url ? await supabase.storage.from('contracts').createSignedUrl(contract.pdf_url, 60 * 30) : { data: null }

  const reached = [
    true,
    Boolean(b.staff_id),
    Boolean(contract?.client_signed_at),
    Boolean(contract?.client_signed_at) && outstanding === 0,
    b.status === 'active' || b.status === 'completed',
  ]
  const canSign = contract?.status === 'sent'
  const canPay = contract && ['client_signed', 'fully_signed', 'active'].includes(contract.status) && outstanding > 0

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <Link href="/account" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-brand-600">
        <ArrowLeft className="size-4" /> My hires
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-navy-800">{b.staff_categories?.name ?? 'Staff request'}</h1>
          <p className="mt-1 text-navy-500">
            {b.location_text} · {b.live_arrangement ? LIVE_LABEL[b.live_arrangement] : ''} · requested {formatDate(b.created_at)}
          </p>
        </div>
        <StatusPill status={b.status} />
      </div>

      {sp.new && <FormAlert message="Request sent! We'll confirm your match soon, usually the same day. We'll notify you by SMS and here." />}
      {sp.payment === 'success' && <FormAlert message="Payment received. Thank you!" />}
      {sp.payment === 'pending' && <FormAlert error="We couldn't confirm the card payment yet. If you were charged, it will show here shortly." />}

      {b.status !== 'cancelled' && (
        <ol className="grid grid-cols-5 gap-2" aria-label="Progress">
          {STEPS.map((label, i) => (
            <li key={label} className="text-center">
              <span className={cn('mx-auto grid size-9 place-items-center rounded-full text-sm font-bold', reached[i] ? 'bg-brand-500 text-white' : 'bg-white text-navy-300 ring-1 ring-navy-100')}>
                {reached[i] ? <Check className="size-4" /> : i + 1}
              </span>
              <span className={cn('mt-1 block text-xs', reached[i] ? 'font-semibold text-navy-700' : 'text-navy-400')}>{label}</span>
            </li>
          ))}
        </ol>
      )}

      {staff && (
        <Panel title="Your staff member">
          <Link href={`/staff/${staff.id}`} className="flex items-center gap-4">
            <span className="relative grid size-16 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand-50">
              {staff.photo_url ? <Image src={staff.photo_url} alt="" fill sizes="64px" className="object-cover" /> : <UserRound className="size-8 text-brand-200" />}
            </span>
            <span>
              <span className="block font-bold text-navy-800">{staff.full_name}</span>
              <span className="block text-sm text-navy-500">{staff.category_name}</span>
              <span className="mt-1 flex flex-wrap gap-1"><StaffBadges s={staff} /></span>
            </span>
          </Link>
        </Panel>
      )}

      {!contract && b.status !== 'cancelled' && (
        <Panel title="What happens next">
          <p className="text-sm text-navy-600">
            {b.staff_id
              ? 'We’re preparing your contract. You’ll get an SMS when it’s ready to sign.'
              : 'We’re finding the best match for you. You’ll get an SMS as soon as we’ve confirmed someone.'}
          </p>
        </Panel>
      )}

      {contract && (
        <Panel
          title="Your contract"
          action={
            pdf?.signedUrl && (
              <a href={pdf.signedUrl} target="_blank" rel="noopener" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">
                <Download className="size-4" /> Download PDF
              </a>
            )
          }
        >
          <div className="mb-4 grid gap-2 text-sm sm:grid-cols-3">
            <Fact label="Staff pay">{contract.rate ? `${formatKes(contract.rate)} / ${contract.rate_period}` : '—'}</Fact>
            <Fact label="Starts">{formatDate(contract.starts_on) || 'As agreed'}</Fact>
            <Fact label="Agency fee">{formatKes(contract.amount_due ?? 0)}</Fact>
          </div>
          <ContractDocument
            terms={contract.terms_json}
            clientSignature={contract.client_signature}
            clientSignedAt={contract.client_signed_at}
            adminSignature={contract.admin_signature}
            adminSignedAt={contract.admin_signed_at}
          />
          {canSign && (
            <div className="mt-6">
              <SignContractForm contractId={contract.id} defaultName={session.full_name ?? ''} />
            </div>
          )}
        </Panel>
      )}

      {canPay && (
        <PayPanel
          contractId={contract.id}
          outstanding={formatKes(outstanding)!}
          defaultPhone={b.clients?.phone ?? session.phone ?? ''}
          mpesa={mpesaMode() !== null}
          card={paystackEnabled()}
          processing={processing}
          agencyPhone={formatPhone(agency.phone)}
        />
      )}

      {payments && payments.length > 0 && (
        <Panel title="Payments">
          <ul className="grid gap-2 text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl bg-blush px-4 py-3">
                <span>
                  {formatKes(p.amount)} · <span className="uppercase">{p.method}</span>
                  {p.mpesa_receipt && <span className="text-navy-400"> · {p.mpesa_receipt}</span>}
                  {p.paid_at && <span className="text-navy-400"> · {formatDate(p.paid_at)}</span>}
                </span>
                <StatusPill status={p.status} />
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {['pending', 'matched'].includes(b.status) && (
        <form action={cancelMyBooking} className="text-right">
          <input type="hidden" name="booking_id" value={b.id} />
          <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50">Cancel this request</Button>
        </form>
      )}
    </div>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-blush px-4 py-3">
      <p className="text-xs text-navy-500">{label}</p>
      <p className="font-bold text-navy-800">{children}</p>
    </div>
  )
}
