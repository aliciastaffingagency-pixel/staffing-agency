import type { Metadata } from 'next'
import Link from 'next/link'
import { SignupForm } from './signup-form'

export const metadata: Metadata = { title: 'Create your account' }

export default function SignupPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight text-navy-800">Create your account</h1>
      <p className="mt-2 text-navy-500">Free for households and businesses. Browse, book and sign in minutes.</p>
      <div className="mt-8">
        <SignupForm />
      </div>
      <p className="mt-8 text-center text-sm text-navy-500">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">Log in</Link>
      </p>
    </>
  )
}
