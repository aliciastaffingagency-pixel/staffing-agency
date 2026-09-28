'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'
import { AGENCY_SLUG } from '@/lib/agency'
import { createClient } from '@/lib/supabase/server'
import { siteUrl } from '@/lib/site-url'
import { safeNext } from '@/lib/utils'

export type AuthState = { error?: string; message?: string; fields?: Record<string, string> }

const callbackUrl = (next: string) => `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`

const email = z.string().trim().toLowerCase().email('Enter a valid email address')

// Friendlier copy for the Supabase errors people actually hit.
function authError(message: string) {
  if (/invalid login credentials/i.test(message)) return 'That email and password don’t match. Try again or use a login link.'
  if (/email not confirmed/i.test(message)) return 'Please confirm your email first — check your inbox for our link.'
  if (/already registered|already been registered/i.test(message)) return 'An account with this email already exists. Log in instead.'
  if (/rate limit/i.test(message)) return 'Too many attempts. Please wait a minute and try again.'
  return message
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = z
    .object({ email, password: z.string().min(1, 'Enter your password') })
    .safeParse({ email: formData.get('email'), password: formData.get('password') })
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields: { email: String(formData.get('email') ?? '') } }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) return { error: authError(error.message), fields: { email: parsed.data.email } }

  redirect(safeNext(formData.get('next')))
}

export async function sendMagicLink(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = email.safeParse(formData.get('email'))
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: { shouldCreateUser: false, emailRedirectTo: callbackUrl(safeNext(formData.get('next'))) },
  })
  // Don't reveal whether an account exists.
  if (error && !/signups not allowed|user not found/i.test(error.message)) return { error: authError(error.message) }
  return { message: `If an account exists for ${parsed.data}, a login link is on its way. Check your inbox.` }
}

const signUpSchema = z.object({
  full_name: z.string().trim().min(2, 'Enter your full name').max(120),
  phone: z
    .string()
    .trim()
    .transform((v) => v.replace(/[\s-]/g, ''))
    .refine((v) => /^(\+?254|0)(7|1)\d{8}$/.test(v), 'Enter a valid Kenyan phone number, e.g. 0712 345 678'),
  email,
  password: z.string().min(8, 'Use at least 8 characters for your password').max(72),
  client_kind: z.enum(['household', 'business']),
})

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  // Echoed back into the form on error — never includes the password.
  const fields = Object.fromEntries(['full_name', 'phone', 'email', 'client_kind'].map((k) => [k, String(formData.get(k) ?? '')]))
  const parsed = signUpSchema.safeParse({ ...fields, password: formData.get('password') })
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields }

  const { password, ...profile } = parsed.data
  const next = safeNext(formData.get('next'), '/account')
  const phone = profile.phone.replace(/^0/, '+254').replace(/^254/, '+254')

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    email: profile.email,
    password,
    options: {
      emailRedirectTo: callbackUrl(next),
      data: { full_name: profile.full_name, phone, client_kind: profile.client_kind, agency_slug: AGENCY_SLUG },
    },
  })
  if (error) return { error: authError(error.message), fields }

  // Email confirmation off → signed in immediately.
  if (data.session) redirect(next)
  return { message: `Almost there! We sent a confirmation link to ${profile.email}. Click it to activate your account.` }
}
