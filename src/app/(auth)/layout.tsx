import Image from 'next/image'
import { BadgeCheck, GraduationCap, ShieldCheck } from 'lucide-react'
import { Logo } from '@/components/brand/logo'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-5 py-8 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
      </div>

      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-navy-800 lg:block">
        <div className="absolute inset-0 bg-sparkle opacity-60" />
        <div className="relative flex h-full flex-col items-center justify-center px-12 text-center text-white">
          <div className="overflow-hidden rounded-t-[10rem] rounded-b-[2rem] border-[6px] border-white/90 shadow-2xl">
            <Image src="/brand/photo-hero.jpg" alt="" width={470} height={900} className="h-[26rem] w-[19rem] object-cover object-top" priority />
          </div>
          <p className="mt-8 font-script text-4xl text-gold-200">We bring comfort &amp; care</p>
          <p className="mt-2 max-w-sm text-white/80">Vetted, trained staff for your home and business — booked, signed and paid online.</p>
          <ul className="mt-6 flex gap-5 text-sm font-medium">
            <li className="inline-flex items-center gap-1.5"><GraduationCap className="size-4 text-gold-300" /> Trained</li>
            <li className="inline-flex items-center gap-1.5"><BadgeCheck className="size-4 text-gold-300" /> Verified</li>
            <li className="inline-flex items-center gap-1.5"><ShieldCheck className="size-4 text-gold-300" /> Trusted</li>
          </ul>
        </div>
      </aside>
    </div>
  )
}
