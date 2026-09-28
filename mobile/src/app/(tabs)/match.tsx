import { router } from 'expo-router'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { Alert, Button, Field, Muted, Screen, StaffItem, type StaffRow } from '@/components/ui'
import { Brand } from '@/constants/brand'
import { api } from '@/lib/api'

type MatchResponse = { summary: string; follow_up: string | null; engine: 'ai' | 'rules'; matches: { staff: StaffRow; reason: string }[] }

export default function Match() {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<MatchResponse | null>(null)

  async function find() {
    setBusy(true)
    setError(null)
    try {
      setResult(await api.match<MatchResponse>(query))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not search')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <Muted>Describe who you need in your own words: the job, the area, live-in or out, and your budget.</Muted>
      <Field
        label="Who do you need?"
        value={query}
        onChangeText={setQuery}
        multiline
        maxLength={800}
        placeholder="e.g. Someone to cook and help with two toddlers, live-in, Kilimani, around 15,000"
      />
      <Alert error={error} />
      <Button title={busy ? 'Finding matches…' : 'Find my matches'} onPress={find} busy={busy} disabled={query.trim().length < 8} />
      {result && (
        <View style={{ gap: 12 }}>
          <Text style={{ fontSize: 16, color: Brand.navy, fontWeight: '600' }}>✨ {result.summary}</Text>
          {result.follow_up && <Muted>{result.follow_up}</Muted>}
          {result.matches.map((m, i) => (
            <View key={m.staff.id} style={{ gap: 6 }}>
              <Muted>
                {i + 1}. {m.reason}
              </Muted>
              <StaffItem s={m.staff} onPress={() => router.push(`/staff/${m.staff.id}`)} />
            </View>
          ))}
          {result.matches.length === 0 && <Button title="Send a request, we'll recruit for you" variant="navy" onPress={() => router.push('/book')} />}
        </View>
      )}
    </Screen>
  )
}
