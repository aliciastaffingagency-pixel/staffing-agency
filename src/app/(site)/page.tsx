import { ContactSection } from '@/components/landing/contact'
import { Hero } from '@/components/landing/hero'
import { HowItWorks, SectionHeading, ServicesSection, StatsBand, ValuesStrip, WhyUs } from '@/components/landing/sections'
import { TestimonialCarousel, type Testimonial } from '@/components/landing/testimonials'
import { ButtonLink } from '@/components/ui/button'
import { getAgency, getCategories, whatsappLink } from '@/lib/agency'
import { createClient } from '@/lib/supabase/server'

async function getTestimonials(agencyId: string): Promise<Testimonial[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('testimonials')
    .select('id, stars, comment, client_first_name, client_area, category_name')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false })
    .limit(8)
  return (data ?? []).filter((t): t is Testimonial => Boolean(t.id && t.comment && t.stars))
}

export default async function HomePage() {
  const [agency, categories] = await Promise.all([getAgency(), getCategories()])
  const testimonials = await getTestimonials(agency.id)

  return (
    <>
      <Hero tagline={agency.tagline ?? 'Your Trusted Home Support Partner'} whatsapp={whatsappLink(agency)} categoryCount={categories.length} />
      <ValuesStrip />
      <ServicesSection categories={categories} />
      <HowItWorks />
      <WhyUs />
      <StatsBand stats={agency.settings.stats ?? []} />

      {testimonials.length > 0 && (
        <section className="bg-blush py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <SectionHeading eyebrow="Reviews" title="What our clients" script="say" />
            <div className="mt-14">
              <TestimonialCarousel items={testimonials} />
            </div>
          </div>
        </section>
      )}

      <ContactSection agency={agency} />

      <section className="px-4 py-20 sm:px-6">
        <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-brand-500 via-brand-600 to-navy-800 px-8 py-14 text-center text-white shadow-lift sm:px-16">
          <div className="pointer-events-none absolute -right-20 -top-20 size-72 rounded-full bg-gold-400/25 blur-2xl" />
          <p className="font-script text-3xl text-gold-200">We bring comfort &amp; care to your home</p>
          <h2 className="mx-auto mt-3 max-w-2xl text-3xl font-extrabold sm:text-4xl">Ready to meet your next great hire?</h2>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/services" variant="gold" size="lg">Browse staff</ButtonLink>
            <ButtonLink href="/signup" variant="outline" size="lg" className="border-white/40 bg-white/10 text-white hover:border-white hover:text-white">
              Create free account
            </ButtonLink>
          </div>
        </div>
      </section>
    </>
  )
}
