import { useState } from 'react'
import { Alert, Button, Field, Muted, Screen } from '@/components/ui'
import { websiteUrl } from '@/lib/api'
import { supabase } from '@/lib/supabase'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function send() {
    const address = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(address)) return setError('Enter a valid email address')
    setBusy(true)
    setError(null)
    // The link opens the website, where they choose the new password; then they log in here.
    const { error: err } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: websiteUrl('/reset-password') })
    setBusy(false)
    if (err && /rate limit/i.test(err.message)) return setError('Too many attempts. Please wait a few minutes and try again.')
    if (err && /fetch|network/i.test(err.message)) return setError('No connection. Check your internet and try again.')
    // Same answer whether or not an account exists, so this can't be used to probe for accounts.
    setMessage(
      `If an account exists for ${address}, we've emailed you a link. Open it, choose a new password on our website, then come back here and log in.`,
    )
  }

  return (
    <Screen>
      <Muted>Enter the email address you signed up with and we&apos;ll send you a link to choose a new password.</Muted>
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <Alert error={error} message={message} />
      {!message && <Button title="Email me a reset link" onPress={send} busy={busy} disabled={!email} />}
    </Screen>
  )
}
