import { Link } from 'expo-router'
import { useState } from 'react'
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Alert, Button, Field, s } from '@/components/ui'
import { Brand } from '@/constants/brand'
import { openWebsite } from '@/lib/links'
import { supabase } from '@/lib/supabase'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    setBusy(true)
    setError(null)
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
    setBusy(false)
    if (err) setError(/invalid login/i.test(err.message) ? 'That email and password don’t match.' : err.message)
  }

  return (
    <SafeAreaView style={s.screen}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
        <View style={{ alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 44, fontStyle: 'italic', fontWeight: '700', color: Brand.magenta }}>Alicia</Text>
          <Text style={{ letterSpacing: 4, fontWeight: '700', color: Brand.navy, fontSize: 12 }}>STAFFING AGENCY</Text>
          <Text style={[s.muted, { marginTop: 10, textAlign: 'center' }]}>Vetted home & business staff. Book, sign and pay from your phone.</Text>
        </View>
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
        <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="password" />
        <Link href="/forgot-password" style={{ alignSelf: 'flex-end', color: Brand.magenta, fontWeight: '600', paddingVertical: 4 }}>
          Forgot password?
        </Link>
        <Alert error={error} />
        <Button title="Log in" onPress={signIn} busy={busy} disabled={!email || !password} />
        <Link href="/sign-up" style={{ textAlign: 'center', color: Brand.magenta, fontWeight: '700', padding: 8 }}>
          New here? Create a free account
        </Link>
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 20 }}>
          <Text onPress={() => openWebsite('/privacy')} accessibilityRole="link" style={[s.muted, { fontSize: 13 }]}>
            Privacy Policy
          </Text>
          <Text onPress={() => openWebsite('/terms')} accessibilityRole="link" style={[s.muted, { fontSize: 13 }]}>
            Terms of Service
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
