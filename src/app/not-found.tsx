import { LogoMark } from '@/components/brand/logo'
import { ButtonLink } from '@/components/ui/button'

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-sparkle px-6 text-center">
      <div>
        <LogoMark className="mx-auto size-20" />
        <p className="mt-6 font-script text-4xl text-brand-500">Oops!</p>
        <h1 className="mt-2 text-2xl font-extrabold text-navy-800">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-navy-500">It may have moved, or the link might be old.</p>
        <ButtonLink href="/" className="mt-8">Back to home</ButtonLink>
      </div>
    </main>
  )
}
