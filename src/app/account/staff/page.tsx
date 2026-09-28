import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { UserRound } from 'lucide-react'
import { EmptyState, PageHeader, Panel, StatusPill } from '@/components/portal/portal-shell'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { formatDate } from '@/lib/utils'
import { ClaimForm, RatingForm, RequestForm } from '../care-forms'

export const metadata: Metadata = { title: 'My staff' }

export default async function MyStaffPage() {
  await requireRole('client')
  const supabase = await createClient()
  const [{ data: claims }, { data: ratings }] = await Promise.all([
    supabase.from('existing_staff_claims').select('id, staff_full_name_freeform, status, agency_confirmed_staff_id, created_at').order('created_at', { ascending: false }),
    supabase.from('ratings').select('claim_id'),
  ])
  const confirmedIds = (claims ?? []).map((c) => c.agency_confirmed_staff_id).filter(Boolean) as string[]
  const { data: staff } = confirmedIds.length
    ? await supabase.from('staff_catalog').select('id, full_name, photo_url, category_name').in('id', confirmedIds)
    : { data: [] }
  const staffById = new Map((staff ?? []).map((s) => [s.id, s]))
  const rated = new Set((ratings ?? []).map((r) => r.claim_id).filter(Boolean))

  return (
    <div className="grid gap-8">
      <PageHeader
        title="My staff"
        description="Already have someone from Alicia Staffing Agency working for you? Add them here so you can rate them and request a replacement online."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[1.3fr_1fr]">
        <Panel title="Staff you've added">
          {claims?.length ? (
            <ul className="grid gap-4">
              {claims.map((c) => {
                const s = c.agency_confirmed_staff_id ? staffById.get(c.agency_confirmed_staff_id) : null
                return (
                  <li key={c.id} className="rounded-3xl border border-brand-100 p-4">
                    <div className="flex items-center gap-3">
                      <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand-50">
                        {s?.photo_url ? <Image src={s.photo_url} alt="" fill sizes="48px" className="object-cover" /> : <UserRound className="size-6 text-brand-200" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-navy-800">
                          {s ? <Link href={`/staff/${s.id}`} className="hover:text-brand-600">{s.full_name}</Link> : c.staff_full_name_freeform}
                        </span>
                        <span className="text-xs text-navy-400">{s?.category_name ?? 'Added'} · {formatDate(c.created_at)}</span>
                      </span>
                      <StatusPill status={c.status} />
                    </div>
                    {c.status === 'pending' && <p className="mt-3 text-sm text-navy-500">We&apos;re checking our records. You&apos;ll be notified once confirmed.</p>}
                    {c.status === 'rejected' && <p className="mt-3 text-sm text-navy-500">We couldn&apos;t match this person to our records. Message us if you think this is a mistake.</p>}
                    {/* The confirmed profile may be hidden from the public catalog; the claim still unlocks rating. */}
                    {c.status === 'confirmed' && c.agency_confirmed_staff_id && (
                      <div className="mt-4 grid gap-5 border-t border-dashed border-brand-100 pt-4 md:grid-cols-2">
                        {rated.has(c.id) ? (
                          <p className="text-sm text-navy-500">Thank you! Your review will appear once the agency has checked it.</p>
                        ) : (
                          <RatingForm staffId={c.agency_confirmed_staff_id} staffName={(s?.full_name ?? c.staff_full_name_freeform).split(' ')[0]} claimId={c.id} />
                        )}
                        <RequestForm kinds={['replacement', 'dispute', 'general']} claimId={c.id} submitLabel="Send request" />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <EmptyState>No one added yet.</EmptyState>
          )}
        </Panel>
        <Panel title="Add someone who already works for you">
          <ClaimForm />
        </Panel>
      </div>
    </div>
  )
}
