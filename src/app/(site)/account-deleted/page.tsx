import type { Metadata } from 'next'
import { CheckCircle2 } from 'lucide-react'
import { ButtonLink } from '@/components/ui/button'

export const metadata: Metadata = { title: 'Account deleted', robots: { index: false } }

export default function AccountDeletedPage() {
  return (
    <section className="bg-sparkle">
      <div className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
        <CheckCircle2 className="mx-auto size-14 text-emerald-500" />
        <h1 className="mt-5 text-3xl font-extrabold text-navy-800">Your account has been deleted</h1>
        <p className="mt-3 text-navy-600">
          We&apos;ve deleted your login and personal data. Signed contracts and payment records are kept, anonymised, only
          for as long as the law requires. You&apos;re always welcome back.
        </p>
        <ButtonLink href="/" className="mt-8">Back to the homepage</ButtonLink>
      </div>
    </section>
  )
}
