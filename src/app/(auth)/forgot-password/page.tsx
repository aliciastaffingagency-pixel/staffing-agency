import type { Metadata } from 'next'
import Link from 'next/link'
import { ForgotForm } from './forgot-form'

export const metadata: Metadata = { title: 'Forgot password' }

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-3xl font-extrabold tracking-tight text-navy-800">Forgot your password?</h1>
      <p className="mt-2 text-navy-500">Enter the email you signed up with and we&apos;ll send you a link to choose a new one.</p>
      <div className="mt-8">
        <ForgotForm />
      </div>
      <p className="mt-8 text-center text-sm text-navy-500">
        Remembered it?{' '}
        <Link href="/login" className="font-semibold text-brand-600 hover:underline">Back to log in</Link>
      </p>
    </>
  )
}
