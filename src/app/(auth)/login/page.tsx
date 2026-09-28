import type { Metadata } from 'next'
import Link from 'next/link'
import { safeNext } from '@/lib/utils'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Log in' }

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const params = await searchParams
  const next = safeNext(typeof params.next === 'string' ? params.next : null)
  const error = typeof params.error === 'string' ? params.error : undefined

  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight text-navy-800">Welcome back</h1>
      <p className="mt-2 text-navy-500">Log in to manage your bookings, contracts and staff.</p>
      <div className="mt-8">
        <LoginForm next={next} initialError={error} />
      </div>
      <p className="mt-8 text-center text-sm text-navy-500">
        New here?{' '}
        <Link href={`/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-600 hover:underline">Create a free account</Link>
      </p>
    </>
  )
}
