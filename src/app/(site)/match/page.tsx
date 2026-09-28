import type { Metadata } from 'next'
import { SectionHeading } from '@/components/landing/sections'
import { MatchFinder } from './match-finder'

export const metadata: Metadata = {
  title: 'Find your match',
  description: 'Describe who you need in plain words and get a ranked shortlist of available, vetted staff.',
}

export default function MatchPage() {
  return (
    <section className="bg-sparkle">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading eyebrow="Smart matching" title="Tell us who you need. We'll find" script="your match">
          No filters to fiddle with. Describe the job, the area and your budget, and get a ranked shortlist of people available now.
        </SectionHeading>
        <div className="mt-12">
          <MatchFinder />
        </div>
      </div>
    </section>
  )
}
