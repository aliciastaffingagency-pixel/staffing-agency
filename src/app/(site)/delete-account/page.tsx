import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalPage } from '@/components/legal/legal-page'
import { ButtonLink, buttonClass } from '@/components/ui/button'
import { WhatsAppIcon } from '@/components/icons'
import { getLegalDetails, LEGAL_UPDATED } from '@/lib/legal'

export const metadata: Metadata = {
  title: 'Delete your account',
  description: 'How to delete your Alicia Staffing account and personal data, what is deleted and what is kept.',
}
export const revalidate = 3600

// Public page required by Google Play: explains and offers every way to request deletion.
export default async function DeleteAccountPage() {
  const a = await getLegalDetails()
  const subject = encodeURIComponent('Delete my Alicia Staffing account')
  const body = encodeURIComponent('Please delete my account and personal data.\n\nName:\nPhone number on the account:\nEmail on the account:')
  return (
    <LegalPage
      title="Delete your Alicia Staffing account"
      updated={LEGAL_UPDATED}
      intro={
        <>
          You can delete your {a.name} account (the Alicia Staffing app and website) and your personal data at any time.
          Choose whichever way is easiest for you.
        </>
      }
    >
      <h2>Option 1: in the Alicia Staffing app</h2>
      <p>Open the app, go to the <strong>Account</strong> tab and tap <strong>Delete my account</strong>. Type DELETE to confirm.</p>

      <h2>Option 2: on the website</h2>
      <p>Log in, open <strong>Settings</strong> from your account menu, and use <strong>Delete my account</strong>.</p>
      <ButtonLink href="/account/settings" className="mt-4">Log in and delete my account</ButtonLink>

      <h2>Option 3: ask us</h2>
      <p>
        Email or WhatsApp us from the email address or phone number on your account. We will confirm it is you and
        delete the account within 7 days, then let you know.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a href={`mailto:${a.email}?subject=${subject}&body=${body}`} className={buttonClass('outline', 'md')}>
          Email {a.email}
        </a>
        {a.whatsapp && (
          <a href={`https://wa.me/${a.whatsapp}?text=${subject}`} target="_blank" rel="noopener" className={buttonClass('whatsapp', 'md')}>
            <WhatsAppIcon className="size-5" /> WhatsApp us
          </a>
        )}
      </div>

      <h2>What is deleted</h2>
      <ul>
        <li>Your login, profile, name, phone number, email and area.</li>
        <li>Booking requests that were not signed, and contracts you had not signed.</li>
        <li>Your messages, reviews, claims about staff, job applications and uploaded documents, and callback requests.</li>
        <li>Your personal details in our activity log (the log keeps only that a change happened).</li>
      </ul>

      <h2>What we keep, and why</h2>
      <ul>
        <li>
          Contracts you signed and payment records, with your name removed from our client records, for at least five
          years after the placement ends, because Kenyan tax law requires it. Signed contract documents are kept as
          signed.
        </li>
        <li>Backups made by our database provider are overwritten on a rolling basis.</li>
      </ul>

      <h2>Staff and job applicants</h2>
      <p>
        Staff profiles and job applications are managed by the agency. To have yours deleted, email{' '}
        <a href={`mailto:${a.email}?subject=${subject}`}>{a.email}</a> or WhatsApp {a.phone}. See our{' '}
        <Link href="/privacy">Privacy Policy</Link> for all your rights.
      </p>
    </LegalPage>
  )
}
