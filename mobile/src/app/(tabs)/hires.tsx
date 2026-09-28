import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { Empty, Loading, s, StatusPill } from '@/components/ui'
import { Brand } from '@/constants/brand'
import { formatDate } from '@/lib/format'
import { supabase } from '@/lib/supabase'

type Row = { id: string; status: string; created_at: string; location_text: string | null; staff_categories: { name: string } | null; staff_profiles: { full_name: string } | null; contracts: { status: string }[] }

function nextStep(b: Row) {
  const c = b.contracts.find((x) => x.status !== 'cancelled' && x.status !== 'ended')
  if (c?.status === 'sent') return 'Contract ready: review & sign'
  if (c && ['client_signed', 'fully_signed'].includes(c.status)) return 'Pay the agency fee'
  if (b.status === 'pending') return 'Finding your match'
  if (b.status === 'matched') return 'Contract on its way'
  return null
}

export default function Hires() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('booking_requests')
      .select('id, status, created_at, location_text, staff_categories(name), staff_profiles(full_name), contracts(status)')
      .order('created_at', { ascending: false })
    setRows((data as Row[] | null) ?? [])
  }, [])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  if (!rows) return <Loading />
  return (
    <FlatList
      style={s.screen}
      data={rows}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false) }} tintColor={Brand.magenta} />}
      ListEmptyComponent={<Empty>No requests yet. Find someone on the first tab, or ask for a smart match.</Empty>}
      renderItem={({ item }) => {
        const step = nextStep(item)
        return (
          <Pressable onPress={() => router.push(`/bookings/${item.id}`)} style={({ pressed }) => [s.card, { gap: 6 }, pressed && { opacity: 0.85 }]} accessibilityRole="button">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: Brand.navy, flexShrink: 1 }}>
                {item.staff_categories?.name ?? 'Staff request'}
                {item.staff_profiles?.full_name ? ` · ${item.staff_profiles.full_name}` : ''}
              </Text>
              <StatusPill status={item.status} />
            </View>
            <Text style={s.muted}>
              {item.location_text} · {formatDate(item.created_at)}
            </Text>
            {step && <Text style={{ color: Brand.magenta, fontWeight: '700' }}>{step} →</Text>}
          </Pressable>
        )
      }}
    />
  )
}
