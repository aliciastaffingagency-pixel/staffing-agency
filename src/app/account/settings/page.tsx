import type { Metadata } from 'next'
import Link from 'next/link'
import { Download } from 'lucide-react'
import { ConfirmDelete } from '@/components/admin/confirm-delete'
import { PageHeader, Panel } from '@/components/portal/portal-shell'
import { buttonClass } from '@/components/ui/button'
import { requireRole } from '@/lib/auth'
import { deleteMyAccount } from './actions'
import { DetailsForm } from './details-form'

export const metadata: Metadata = { title: 'Account settings' }

export default async function AccountSettingsPage() {
  const session = await requireRole('client')

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <PageHeader title="Account settings" description="Your details, your data and your account." />

      <Panel title="Your details">
        <DetailsForm name={session.full_name ?? ''} phone={session.phone ?? ''} email={session.email ?? ''} />
      </Panel>

      <Panel title="Your data">
        <p className="text-sm text-navy-600">
          Download a copy of everything we hold about you: your profile, requests, contracts, payments, messages and reviews. See our{' '}
          <Link href="/privacy" className="font-semibold text-brand-600 hover:underline">Privacy Policy</Link> for how we use it.
        </p>
        <a href="/account/export" download className={buttonClass('outline', 'sm', 'mt-4')}>
          <Download className="size-4" /> Download my data
        </a>
      </Panel>

      <ConfirmDelete
        action={deleteMyAccount}
        id={session.id}
        phrase="DELETE"
        title="Delete my account"
        button="Delete my account"
        deletes={[
          'Your login, profile and contact details',
          'Open requests and any contract you have not signed',
          'Your messages, reviews, staff claims and job applications',
        ]}
        keeps={['Signed contracts and payment records, anonymised, for the period the law requires (see the Privacy Policy)']}
      />
    </div>
  )
}
