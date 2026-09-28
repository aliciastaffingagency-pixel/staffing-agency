import type { Metadata } from 'next'
import { Phone } from 'lucide-react'
import { EmptyState, PageHeader, StatusPill } from '@/components/portal/portal-shell'
import { WhatsAppIcon } from '@/components/icons'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/utils'
import { updateLead } from './actions'

export const metadata: Metadata = { title: 'Leads' }

const NEXT: Record<string, { status: string; label: string }[]> = {
  new: [{ status: 'contacted', label: 'Mark contacted' }, { status: 'closed', label: 'Close' }],
  contacted: [{ status: 'converted', label: 'Converted' }, { status: 'closed', label: 'Close' }],
  converted: [],
  closed: [{ status: 'new', label: 'Reopen' }],
}

export default async function LeadsPage() {
  const session = await requireRole('super_admin')
  const supabase = await createClient()
  const { data: leads } = await supabase.from('leads').select('*').eq('agency_id', session.agency_id).order('created_at', { ascending: false }).limit(200)

  return (
    <div className="grid gap-8">
      <PageHeader title="Leads" description="Visitors who asked for a callback through the website concierge. Call them back while they're keen." />
      {leads?.length ? (
        <ul className="grid gap-3">
          {leads.map((l) => (
            <li key={l.id} className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-brand-100 bg-white p-5">
              <div className="min-w-0">
                <p className="font-bold text-navy-800">
                  {l.name ?? 'Visitor'} <span className="font-normal text-navy-500">· {l.phone}</span>
                </p>
                <p className="mt-1 text-sm text-navy-700">{l.need}</p>
                <p className="mt-1 text-xs text-navy-400">
                  {[l.area, l.start_date && `start ${l.start_date}`, l.budget && `budget ${l.budget}`].filter(Boolean).join(' · ')}
                  {' · '}
                  {formatDateTime(l.created_at)}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={l.status === 'new' ? 'open' : l.status === 'converted' ? 'confirmed' : l.status === 'closed' ? 'resolved' : 'processing'} />
                {l.phone && (
                  <>
                    <a href={`tel:${l.phone}`} className="grid size-9 place-items-center rounded-full bg-navy-50 text-navy-600 hover:bg-brand-50" aria-label={`Call ${l.name ?? 'lead'}`}>
                      <Phone className="size-4" />
                    </a>
                    <a href={`https://wa.me/${l.phone.replace(/^\+/, '')}`} target="_blank" rel="noopener" className="grid size-9 place-items-center rounded-full bg-[#25D366] text-white" aria-label="WhatsApp">
                      <WhatsAppIcon className="size-4" />
                    </a>
                  </>
                )}
                <form action={updateLead} className="flex gap-1">
                  <input type="hidden" name="id" value={l.id} />
                  {NEXT[l.status].map((n) => (
                    <button key={n.status} name="status" value={n.status} className="rounded-full border border-navy-100 px-3 py-1.5 text-xs font-semibold text-navy-600 hover:border-brand-300 hover:text-brand-600">
                      {n.label}
                    </button>
                  ))}
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState>No leads yet. They appear here when visitors leave their number in the website chat.</EmptyState>
      )}
    </div>
  )
}
