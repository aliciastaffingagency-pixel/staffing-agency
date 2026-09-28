import { Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Brand } from '@/constants/brand'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { supabase } from '@/lib/supabase'

type Msg = { id: string; body: string; sender_role: string; created_at: string }

// Live chat with the agency (Supabase Realtime; RLS limits it to this thread).
export default function Conversation() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [subject, setSubject] = useState('Conversation')
  const [messages, setMessages] = useState<Msg[]>([])
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const list = useRef<FlatList<Msg>>(null)

  const add = (m: Msg) => setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m].sort((a, b) => a.created_at.localeCompare(b.created_at))))
  const markRead = () => supabase.from('message_threads').update({ client_last_read_at: new Date().toISOString() }).eq('id', id).then(() => {})

  useEffect(() => {
    supabase.from('message_threads').select('subject').eq('id', id).maybeSingle().then(({ data }) => data?.subject && setSubject(data.subject))
    supabase.from('messages').select('id, body, sender_role, created_at').eq('thread_id', id).order('created_at').then(({ data }) => setMessages(data ?? []))
    markRead()
    const channel = supabase
      .channel(`thread-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `thread_id=eq.${id}` }, (payload) => {
        add(payload.new as Msg)
        markRead()
      })
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function send() {
    const body = draft.trim()
    if (!body) return
    setBusy(true)
    setError(null)
    try {
      const res = await api.op<{ id: string; created_at: string }>('messages', { thread_id: id, body })
      add({ id: res.id, body, sender_role: 'client', created_at: res.created_at })
      setDraft('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Brand.cream }} edges={['bottom', 'left', 'right']}>
      <Stack.Screen options={{ title: subject }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <FlatList
          ref={list}
          data={messages}
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 16, gap: 8 }}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          renderItem={({ item }) => {
            const mine = item.sender_role === 'client'
            return (
              <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', backgroundColor: mine ? Brand.magenta : Brand.white, borderRadius: 20, padding: 12 }}>
                {!mine && <Text style={{ color: Brand.magenta, fontWeight: '700', fontSize: 12 }}>Alicia Staffing Agency</Text>}
                <Text style={{ color: mine ? Brand.white : Brand.navy, fontSize: 15 }}>{item.body}</Text>
                <Text style={{ color: mine ? '#FFFFFFB3' : Brand.navyMuted, fontSize: 10, marginTop: 4 }}>{formatDateTime(item.created_at)}</Text>
              </View>
            )
          }}
        />
        {error && <Text style={{ color: Brand.red, paddingHorizontal: 16 }}>{error}</Text>}
        <View style={{ flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: Brand.line, backgroundColor: Brand.white }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a message…"
            placeholderTextColor={Brand.navyMuted}
            multiline
            maxLength={5000}
            style={{ flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, borderWidth: 1, borderColor: Brand.line, paddingHorizontal: 14, paddingTop: 11, color: Brand.navy }}
            accessibilityLabel="Message"
          />
          <Pressable onPress={send} disabled={busy || !draft.trim()} accessibilityRole="button" accessibilityLabel="Send" style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: Brand.magenta, alignItems: 'center', justifyContent: 'center', opacity: busy || !draft.trim() ? 0.5 : 1 }}>
            <Text style={{ color: Brand.white, fontSize: 18 }}>➤</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
