import type { Metadata, Viewport } from 'next'
import { Dancing_Script, Poppins } from 'next/font/google'
import './globals.css'

const poppins = Poppins({
  variable: '--font-poppins',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
})

const dancing = Dancing_Script({
  variable: '--font-dancing',
  subsets: ['latin'],
  weight: ['700'],
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'),
  title: {
    default: 'Alicia Staffing Agency — Trusted Home & Business Staff',
    template: '%s | Alicia Staffing Agency',
  },
  description:
    'Vetted house helps, nannies, cleaners, caregivers, chefs, drivers, gardeners, shop attendants and security guards. Browse, book, sign and pay online — reliable, trustworthy, professional.',
  openGraph: {
    siteName: 'Alicia Staffing Agency',
    images: ['/brand/photo-hero.jpg'],
    locale: 'en_KE',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#D61F7A',
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${poppins.variable} ${dancing.variable}`} data-scroll-behavior="smooth">
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  )
}
