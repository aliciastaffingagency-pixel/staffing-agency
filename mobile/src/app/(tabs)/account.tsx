import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { Linking, Text, View } from 'react-native'
import { Button, Card, H1, Muted, Screen } from '@/components/ui'
import { Brand } from '@/constants/brand'
import { useAuth } from '@/lib/auth'
import { formatDateTime } from '@/lib/format'
import { openWebsite } from '@/lib/links'
import { supabase } from '@/lib/supabase'

type Note = { id: string; message: string; created_at: string; read: boolean }

export default function Account() {
  const { profile, signOut } = useAuth()
  const [notes, setNotes] = useState<Note[]>([])
  const [whatsapp, setWhatsapp] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      supabase
        .from('agencies')
        .select('whatsapp')
        .eq('slug', process.env.EXPO_PUBLIC_AGENCY_SLUG ?? 'alicia')
        .maybeSingle()
        .then(({ data }) => setWhatsapp(data?.whatsapp ?? null))
      supabase
        .from('notifications')
        .select('id, message, created_at, read')
        .order('created_at', { ascending: false })
        .limit(20)
        .then(({ data }) => {
          setNotes(data ?? [])
          const unread = (data ?? []).filter((n) => !n.read).map((n) => n.id)
          if (unread.length) supabase.from('notifications').update({ read: true }).in('id', unread).then(() => {})
        })
    }, []),
  )

  return (
    <Screen>
      <H1>
        Hello{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
      </H1>
      <Muted>{profile?.email}</Muted>

      <Card>
        <Text style={{ fontWeight: '700', color: Brand.navy, fontSize: 16 }}>Notifications</Text>
        {notes.length ? (
          notes.map((n) => (
            <View key={n.id} style={{ borderTopWidth: 1, borderTopColor: Brand.line, paddingTop: 8 }}>
              <Text style={{ color: Brand.navy, fontWeight: n.read ? '400' : '700' }}>{n.message}</Text>
              <Muted style={{ fontSize: 12 }}>{formatDateTime(n.created_at)}</Muted>
            </View>
          ))
        ) : (
          <Muted>You&apos;re all caught up.</Muted>
        )}
      </Card>

      <Card>
        <Text style={{ fontWeight: '700', color: Brand.navy, fontSize: 16 }}>More on the website</Text>
        <Muted>Add staff who already work for you, see receipts and download contracts.</Muted>
        <Button title="Open my account online" variant="outline" onPress={() => openWebsite('/account')} />
        <Button title="Looking for work? See jobs" variant="outline" onPress={() => openWebsite('/jobs')} />
        {whatsapp && <Button title="WhatsApp the agency" variant="whatsapp" onPress={() => Linking.openURL(`https://wa.me/${whatsapp}`)} />}
      </Card>

      <Card>
        <Text style={{ fontWeight: '700', color: Brand.navy, fontSize: 16 }}>Privacy and your data</Text>
        <Muted>How we use your data, a copy of everything we hold about you, and deleting your account.</Muted>
        <Button title="Privacy Policy" variant="outline" onPress={() => openWebsite('/privacy')} />
        <Button title="Terms of Service" variant="outline" onPress={() => openWebsite('/terms')} />
        <Button title="Download my data" variant="outline" onPress={() => openWebsite('/account/settings')} />
        <Button title="Delete my account" variant="outline" onPress={() => router.push('/delete-account')} />
      </Card>

      <Button title="Log out" variant="navy" onPress={signOut} />
    </Screen>
  )
}
