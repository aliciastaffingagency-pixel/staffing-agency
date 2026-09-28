import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { SectionHeading } from '@/components/landing/sections'
import { GENERAL_DOCUMENTS } from '@/lib/jobs'
import { ApplicationForm } from '../application-form'

export const metadata: Metadata = {
  title: 'Apply to join the agency',
  description: 'Send a general application to join Alicia Staffing Agency, or propose your own terms. Upload your ID and CV online.',
}

export default function GeneralApplicationPage() {
  return (
    <section className="bg-sparkle">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
        <Link href="/jobs" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-brand-600">
          <ArrowLeft className="size-4" /> Current vacancies
        </Link>
        <div className="mt-6">
          <SectionHeading eyebrow="General application" title="Join our" script="team">
            Tell us about yourself and upload your documents. We&apos;ll call you when a suitable placement comes up.
          </SectionHeading>
        </div>
        <div className="mt-12">
          <ApplicationForm requiredDocuments={GENERAL_DOCUMENTS.slice(0, 1)} optionalDocuments={GENERAL_DOCUMENTS.slice(1).concat('Certificate of good conduct', 'Reference letter')} />
        </div>
      </div>
    </section>
  )
}
