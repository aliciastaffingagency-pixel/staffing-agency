import Link from 'next/link'

export const LEGAL_LINKS = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
  { href: '/cookies', label: 'Cookie Policy' },
  { href: '/refunds', label: 'Refund Policy' },
  { href: '/delete-account', label: 'Delete your account' },
]

// Shared layout for the legal pages: readable measure, headings, lists and a page index.
export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-cream">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Legal" className="lg:sticky lg:top-32 lg:self-start">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-navy-400">Legal</p>
          <ul className="mt-3 flex flex-wrap gap-2 lg:grid lg:gap-1">
            {LEGAL_LINKS.map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="block rounded-xl px-3 py-2 text-sm font-medium text-navy-600 hover:bg-white hover:text-brand-600">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <article className="max-w-3xl text-[0.98rem] leading-relaxed text-navy-700 [&_a]:font-semibold [&_a]:text-brand-600 [&_a:hover]:underline [&_h2]:mt-10 [&_h2]:scroll-mt-28 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-navy-800 [&_h3]:mt-6 [&_h3]:font-bold [&_h3]:text-navy-800 [&_li]:mt-1.5 [&_p]:mt-3 [&_table]:mt-4 [&_table]:w-full [&_table]:text-sm [&_td]:border-t [&_td]:border-brand-100 [&_td]:py-2 [&_td]:pr-3 [&_td]:align-top [&_th]:pb-2 [&_th]:pr-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-navy-800 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-navy-800 sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-navy-400">Last updated {updated}</p>
          <div className="mt-6 rounded-2xl bg-blush px-5 py-4 text-navy-700">{intro}</div>
          {children}
        </article>
      </div>
    </section>
  )
}
