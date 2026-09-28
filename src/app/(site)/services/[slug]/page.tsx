import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { CategoryIcon } from '@/components/category-icon'
import { Reveal, Stagger, StaggerItem } from '@/components/motion'
import { StaffCard, STAFF_CARD_COLUMNS } from '@/components/staff/staff-card'
import { buttonClass } from '@/components/ui/button'
import { WhatsAppIcon } from '@/components/icons'
import { getAgency, getCategories, whatsappLink } from '@/lib/agency'
import { createClient } from '@/lib/supabase/server'

async function getCategory(slug: string) {
  const categories = await getCategories()
  return categories.find((c) => c.slug === slug) ?? null
}

export async function generateMetadata({ params }: PageProps<'/services/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const category = await getCategory(slug)
  return category ? { title: category.name, description: category.description ?? undefined } : {}
}

export default async function CategoryPage({ params }: PageProps<'/services/[slug]'>) {
  const { slug } = await params
  const [agency, category] = await Promise.all([getAgency(), getCategory(slug)])
  if (!category) notFound()

  const supabase = await createClient()
  const { data: staff } = await supabase
    .from('staff_catalog')
    .select(STAFF_CARD_COLUMNS)
    .eq('agency_id', agency.id)
    .eq('category_id', category.id)
    .order('rating_avg', { ascending: false })

  return (
    <section className="bg-sparkle">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <Link href="/services" className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-500 hover:text-brand-600">
          <ArrowLeft className="size-4" /> All services
        </Link>

        <Reveal className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
          <span className="grid size-20 shrink-0 place-items-center rounded-3xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lift">
            <CategoryIcon name={category.icon} className="size-10" />
          </span>
          <div>
            <h1 className="text-4xl font-extrabold tracking-tight text-navy-800">{category.name}</h1>
            {category.description && <p className="mt-2 max-w-2xl text-lg text-navy-600">{category.description}</p>}
          </div>
        </Reveal>

        {staff && staff.length > 0 ? (
          <Stagger className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {staff.map((s) => (
              <StaggerItem key={s.id}>
                <StaffCard s={s} />
              </StaggerItem>
            ))}
          </Stagger>
        ) : (
          <Reveal className="mt-12 rounded-[2rem] border border-dashed border-brand-200 bg-white/80 px-6 py-14 text-center">
            <p className="font-script text-3xl text-brand-500">Profiles coming soon</p>
            <p className="mx-auto mt-3 max-w-lg text-navy-600">
              We&apos;re adding vetted {category.name.toLowerCase()} profiles here. In the meantime, message us and we&apos;ll
              match you with someone suitable today.
            </p>
            <a
              href={whatsappLink(agency, `Hello ${agency.name}, I'm looking for a ${category.name}.`)}
              target="_blank"
              rel="noopener"
              className={buttonClass('whatsapp', 'lg', 'mt-7')}
            >
              <WhatsAppIcon className="size-5" /> Ask about a {category.name}
            </a>
          </Reveal>
        )}
      </div>
    </section>
  )
}
