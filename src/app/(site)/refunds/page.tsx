import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/legal/legal-page'
import { getLegalDetails, LEGAL_UPDATED } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Refund Policy',
  description: 'When the Alicia Staffing Agency placement fee is refunded, replacements, and how to ask for a refund.',
}
export const revalidate = 3600

export default async function RefundsPage() {
  const a = await getLegalDetails()
  return (
    <LegalPage
      title="Refund & Cancellation Policy"
      updated={LEGAL_UPDATED}
      intro={
        <>
          This policy covers the agency fee you pay {a.name} for a placement. The staff member’s own pay is agreed in
          your placement agreement and paid by you directly to them; it is not handled by us.
        </>
      }
    >
      <h2>Before you sign</h2>
      <p>Browsing, requesting staff and receiving a contract are free. You can cancel a request at any time before signing, at no cost.</p>

      <h2>After you pay, before the placement starts</h2>
      <p>
        If we cancel, or cannot provide a suitable staff member for a placement you have paid for, we refund the agency
        fee in full. If you cancel after paying but before the start date, contact us and we will refund the fee less any
        costs we have already incurred for your placement, which we will explain to you.
      </p>

      <h2>Replacements</h2>
      <p>
        If your staff member leaves or is not a good fit within {a.terms.replacement_window_days} days of the start date,
        we provide up to {a.terms.max_replacements} replacement(s) at no extra agency fee, as set out in your placement
        agreement. Request a replacement from your account. If we cannot find a suitable replacement within that period,
        we will discuss a partial refund with you.
      </p>

      <h2>How refunds are paid</h2>
      <ul>
        <li>Approved refunds go back to the method you paid with: to your M-Pesa number, or to your card through Paystack.</li>
        <li>We aim to process an approved refund within 14 days. Card refunds can take a few more days to show, depending on your bank.</li>
      </ul>

      <h2>Asking for a refund</h2>
      <p>
        Send us a message from your account, email <a href={`mailto:${a.email}`}>{a.email}</a> or WhatsApp {a.phone},
        with your name and the booking. Your rights under Kenyan consumer law are not affected. See also our{' '}
        <Link href="/terms">Terms of Service</Link>.
      </p>
    </LegalPage>
  )
}
