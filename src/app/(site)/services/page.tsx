import type { Metadata } from 'next'
import { CategoryGrid, SectionHeading } from '@/components/landing/sections'
import { getCategories } from '@/lib/agency'

export const metadata: Metadata = {
  title: 'Our services',
  description: 'Browse every type of home and business staff we place — vetted, trained and ready to serve.',
}

export default async function ServicesPage() {
  const categories = await getCategories()
  return (
    <section className="bg-sparkle">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <SectionHeading eyebrow="All services" title="Find the right" script="person">
          Choose a service to see available staff, their checks and their rates.
        </SectionHeading>
        <div className="mt-14">
          <CategoryGrid categories={categories} />
        </div>
      </div>
    </section>
  )
}
