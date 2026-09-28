import { useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Alert, Button, Field, Screen } from '@/components/ui'
import { Brand } from '@/constants/brand'
import { websiteUrl } from '@/lib/api'
import { openWebsite } from '@/lib/links'
import { supabase } from '@/lib/supabase'

const normalizePhone = (v: string) => {
  const m = v.replace(/[\s()-]/g, '').match(/^(?:\+?254|0)?([17]\d{8})$/)
  return m ? `+254${m[1]}` : null
}

export default function SignUp() {
  const [kind, setKind] = useState<'household' | 'business'>('household')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function signUp() {
    const p = normalizePhone(phone)
    if (name.trim().length < 2) return setError('Enter your full name')
    if (!p) return setError('Enter a valid Kenyan phone number, e.g. 0712 345 678')
    if (password.length < 8) return setError('Use at least 8 characters for your password')
    if (!agreed) return setError('Please agree to the Terms of Service and Privacy Policy')
    setBusy(true)
    setError(null)
    // Role is always "client" — the database ignores any role sent from the app.
    // terms_accepted is recorded as a timestamp on the profile by the sign-up trigger.
    const { data, error: err } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        emailRedirectTo: websiteUrl('/login?confirmed=1'),
        data: { full_name: name.trim(), phone: p, client_kind: kind, agency_slug: process.env.EXPO_PUBLIC_AGENCY_SLUG ?? 'alicia', terms_accepted: 'true' },
      },
    })
    setBusy(false)
    if (err) return setError(err.message)
    if (!data.session) setMessage(`Almost there! Confirm your email from the link we sent to ${email}, then come back here and log in.`)
  }

  return (
    <Screen>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {(['household', 'business'] as const).map((k) => (
          <Pressable
            key={k}
            onPress={() => setKind(k)}
            accessibilityRole="radio"
            accessibilityState={{ selected: kind === k }}
            style={{ flex: 1, padding: 14, borderRadius: 16, borderWidth: 2, borderColor: kind === k ? Brand.magenta : Brand.line, backgroundColor: kind === k ? Brand.magentaSoft : Brand.white, alignItems: 'center' }}
          >
            <Text style={{ fontWeight: '700', color: kind === k ? Brand.magentaDark : Brand.navySoft }}>{k === 'household' ? '🏠 Home' : '🏢 Business'}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Full name" value={name} onChangeText={setName} autoComplete="name" />
      <Field label="Phone (M-Pesa number)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0712 345 678" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="new-password" />
      <Pressable
        onPress={() => setAgreed((a) => !a)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: agreed }}
        style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}
      >
        <View
          style={{ width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center', borderColor: agreed ? Brand.magenta : Brand.navyMuted, backgroundColor: agreed ? Brand.magenta : Brand.white }}
        >
          {agreed && <Text style={{ color: Brand.white, fontWeight: '800', fontSize: 14 }}>✓</Text>}
        </View>
        <Text style={{ flex: 1, color: Brand.navy, lineHeight: 22 }}>
          I agree to the{' '}
          <Text onPress={() => openWebsite('/terms')} accessibilityRole="link" style={{ color: Brand.magenta, fontWeight: '700' }}>
            Terms of Service
          </Text>{' '}
          and{' '}
          <Text onPress={() => openWebsite('/privacy')} accessibilityRole="link" style={{ color: Brand.magenta, fontWeight: '700' }}>
            Privacy Policy
          </Text>
        </Text>
      </Pressable>
      <Alert error={error} message={message} />
      <Button title="Create account" onPress={signUp} busy={busy} disabled={!email || !password} />
    </Screen>
  )
}
