import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { FlatList, Pressable, Text, View } from 'react-native'
import { Alert, Button, Card, Empty, Field, Loading, s, StatusPill } from '@/components/ui'
import { Brand } from '@/constants/brand'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { supabase } from '@/lib/supabase'

type Thread = { id: string; subject: string | null; kind: string; status: string; last_message_at: string; client_last_read_at: string }

export default function Messages() {
  const [threads, setThreads] = useState<Thread[] | null>(null)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('message_threads').select('id, subject, kind, status, last_message_at, client_last_read_at').order('last_message_at', { ascending: false })
    setThreads(data ?? [])
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  async function ask() {
    setBusy(true)
    setError(null)
    try {
      const { threadId } = await api.op<{ threadId: string }>('threads', { kind: 'general', subject: 'Question from the app', body })
      setBody('')
      router.push(`/messages/${threadId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send')
    } finally {
      setBusy(false)
    }
  }

  if (!threads) return <Loading />
  return (
    <FlatList
      style={s.screen}
      data={threads}
      keyExtractor={(t) => t.id}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      ListHeaderComponent={
        <Card style={{ marginBottom: 6 }}>
          <Field label="Ask the agency anything" value={body} onChangeText={setBody} multiline maxLength={5000} />
          <Alert error={error} />
          <Button title="Send message" onPress={ask} busy={busy} disabled={body.trim().length < 5} />
        </Card>
      }
      ListEmptyComponent={<Empty>No conversations yet.</Empty>}
      renderItem={({ item }) => {
        const unread = item.last_message_at > item.client_last_read_at
        return (
          <Pressable onPress={() => router.push(`/messages/${item.id}`)} style={({ pressed }) => [s.card, pressed && { opacity: 0.85 }]} accessibilityRole="button">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontWeight: unread ? '800' : '600', color: Brand.navy, flexShrink: 1 }}>
                {unread ? '● ' : ''}
                {item.subject}
              </Text>
              <StatusPill status={item.status} />
            </View>
            <Text style={s.muted}>{formatDateTime(item.last_message_at)}</Text>
          </Pressable>
        )
      }}
    />
  )
}
