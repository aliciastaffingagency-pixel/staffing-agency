import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/legal/legal-page'
import { getLegalDetails, LEGAL_UPDATED } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms for using the Alicia Staffing Agency website and app as a client, job applicant or staff member.',
}
export const revalidate = 3600

export default async function TermsPage() {
  const a = await getLegalDetails()
  return (
    <LegalPage
      title="Terms of Service"
      updated={LEGAL_UPDATED}
      intro={
        <>
          These terms apply when you use the {a.name} website or the Alicia Staffing app, whether you are hiring staff,
          applying for work or working through us. By creating an account or using the service you agree to them.
          Please also read our <Link href="/privacy">Privacy Policy</Link>.
        </>
      }
    >
      <h2>1. What we do</h2>
      <p>
        {a.name} is a staffing agency. We recruit and vet domestic and business staff (such as house helps, nannies,
        cooks, caregivers, drivers, gardeners, shop attendants and security guards) and match them with clients. Each
        placement is governed by a written placement agreement that the client and the agency sign online. Where these
        terms and a signed placement agreement differ about a placement, the placement agreement applies.
      </p>

      <h2>2. Your account</h2>
      <ul>
        <li>You must be 18 or older and give accurate information.</li>
        <li>Keep your password private. You are responsible for activity on your account. Tell us straight away if you think someone else has used it.</li>
        <li>You can delete your account at any time. See <Link href="/delete-account">Delete your account</Link>.</li>
      </ul>

      <h2>3. Hiring staff (clients)</h2>
      <ul>
        <li>A booking request is not a guarantee: we confirm a suitable match before any contract is prepared.</li>
        <li>The staff member’s pay, working arrangement, start date and the agency fee are set out in your placement agreement. The agency fee is due once you sign; the placement is confirmed when it is paid.</li>
        <li>
          Your placement agreement includes a {a.terms.trial_period_days}-day trial period, {a.terms.notice_period_days} days’ notice after
          the trial, and up to {a.terms.max_replacements} free replacement(s) within {a.terms.replacement_window_days} days of the start date.
        </li>
        <li>You agree to treat staff fairly and lawfully: pay them on time and in full, give reasonable hours and rest days, and provide safe working conditions (and decent accommodation and meals for live-in staff), in line with Kenyan employment law.</li>
        <li>Please raise any concern with us first, through your account, by phone or on WhatsApp, so we can help resolve it.</li>
      </ul>

      <h2>4. Applying for work and working through us</h2>
      <ul>
        <li>Information and documents you give us must be true and your own. Applying does not guarantee a placement.</li>
        <li>You agree to the vetting checks described when you apply (ID verification, references, background checks and training).</li>
        <li>Your profile is only shown to clients after you agree to it being published, and you can withdraw that agreement at any time.</li>
        <li>Staff profiles are created and edited by the agency only.</li>
      </ul>

      <h2>5. Payments</h2>
      <p>
        Fees are in Kenya shillings. Payments are processed by Safaricom M-Pesa or Paystack (cards), and each payment is
        recorded in your account. Refunds follow our <Link href="/refunds">Refund Policy</Link>.
      </p>

      <h2>6. Reviews and messages</h2>
      <p>
        Reviews must be honest and about your own experience. We check reviews before they are published and may
        decline or remove content that is abusive, false, discriminatory or shares private information.
      </p>

      <h2>7. Acceptable use</h2>
      <p>
        Do not misuse the service: no false identities, fraud, harassment, discrimination, attempts to access other
        people’s data, automated scraping, or security testing without our written permission.
      </p>

      <h2>8. Vetting and responsibility</h2>
      <p>
        We take reasonable care in recruiting and vetting, and each profile shows which checks a person has passed.
        Vetting reduces risk but cannot guarantee how anyone will behave in future. Clients should give reasonable
        supervision and tell us immediately about any concern.
      </p>

      <h2>9. Liability</h2>
      <p>
        We are responsible for providing our services with reasonable skill and care. As far as the law allows, we are
        not liable for indirect or consequential losses. Nothing in these terms limits any rights you have under Kenyan
        law that cannot be limited, including under the Consumer Protection Act, 2012.
      </p>

      <h2>10. Suspension</h2>
      <p>We may suspend or close accounts that break these terms or put others at risk. You may stop using the service at any time.</p>

      <h2>11. Changes</h2>
      <p>We may update these terms and will show the new date above. Important changes will be announced by email, SMS or in your account.</p>

      <h2>12. Law and disputes</h2>
      <p>
        These terms are governed by the laws of Kenya. If a dispute arises, contact us first so we can try to settle it.
        If we cannot, it may be referred to mediation or to the courts of Kenya.
      </p>

      <h2>13. Contact</h2>
      <p>
        {a.name}, {a.address}. Email <a href={`mailto:${a.email}`}>{a.email}</a>, phone or WhatsApp {a.phone}.
      </p>
    </LegalPage>
  )
}
