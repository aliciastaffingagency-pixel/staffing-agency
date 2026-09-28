import { useState } from 'react'
import { Alert as NativeAlert, Text } from 'react-native'
import { Alert, Button, Card, Field, H1, Muted, Screen } from '@/components/ui'
import { Brand } from '@/constants/brand'
import { api } from '@/lib/api'
import { openWebsite } from '@/lib/links'
import { supabase } from '@/lib/supabase'

// In-app account deletion (a Google Play requirement). Same rules as the website.
export default function DeleteAccount() {
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function remove() {
    setBusy(true)
    setError(null)
    try {
      const res = await api.op<{ retainedContracts?: number }>('delete-account', { confirm: 'DELETE' })
      NativeAlert.alert(
        'Account deleted',
        res.retainedContracts
          ? 'Your account and personal data are deleted. Contracts you signed and payment records are kept without your details, as the law requires.'
          : 'Your account and personal data are deleted.',
      )
      // The login no longer exists on the server, so only clear it from this phone. The app returns to sign-in.
      await supabase.auth.signOut({ scope: 'local' })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  return (
    <Screen>
      <H1>Delete my account</H1>
      <Muted>This permanently deletes your Alicia Staffing account, in the app and on the website. It can&apos;t be undone.</Muted>

      <Card>
        <Text style={{ fontWeight: '700', color: Brand.navy, fontSize: 16 }}>What is deleted</Text>
        <Bullet>Your login and profile: name, phone number, email and area.</Bullet>
        <Bullet>Booking requests, and contracts you had not signed.</Bullet>
        <Bullet>Your messages, reviews, claims, job applications and uploaded documents.</Bullet>
      </Card>

      <Card>
        <Text style={{ fontWeight: '700', color: Brand.navy, fontSize: 16 }}>What we keep, and why</Text>
        <Bullet>
          Contracts you signed and payment records, with your details removed, for five years after the placement ends,
          because Kenyan tax law requires it.
        </Bullet>
        <Bullet>If a staff member is working for you now, the agency is told so the placement can be ended properly.</Bullet>
      </Card>

      <Field label="Type DELETE to confirm" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" autoCorrect={false} />
      <Alert error={error} />
      <Button title="Delete my account" variant="danger" onPress={remove} busy={busy} disabled={confirm.trim().toUpperCase() !== 'DELETE'} />
      <Button title="Read the full details online" variant="outline" onPress={() => openWebsite('/delete-account')} />
    </Screen>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return <Muted>• {children}</Muted>
}
