import { Image } from 'expo-image'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { Button, Card, Loading, Muted, Screen } from '@/components/ui'
import { Brand } from '@/constants/brand'
import { formatDate, formatKes, LIVE_LABEL } from '@/lib/format'
import { supabase, type Database } from '@/lib/supabase'

type Staff = Database['public']['Views']['staff_catalog']['Row']
type Review = { id: string | null; stars: number | null; comment: string | null; client_first_name: string | null; created_at: string | null }

export default function StaffProfile() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [staff, setStaff] = useState<Staff | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])

  useEffect(() => {
    supabase.from('staff_catalog').select('*').eq('id', id).maybeSingle().then(({ data }) => setStaff(data))
    supabase.from('staff_reviews').select('id, stars, comment, client_first_name, created_at').eq('staff_id', id).order('created_at', { ascending: false }).limit(20).then(({ data }) => setReviews(data ?? []))
  }, [id])

  if (!staff) return <Loading />
  const first = staff.full_name?.split(' ')[0] ?? 'them'
  const badges = [staff.verified_badge && 'ID verified', staff.background_checked_badge && 'Background-checked', staff.trained_badge && 'Trained'].filter(Boolean) as string[]

  return (
    <Screen>
      <Stack.Screen options={{ title: staff.full_name ?? 'Staff profile' }} />
      <View style={{ aspectRatio: 1, borderRadius: 28, overflow: 'hidden', backgroundColor: Brand.magentaSoft, alignItems: 'center', justifyContent: 'center' }}>
        {staff.photo_url ? <Image source={{ uri: staff.photo_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Text style={{ fontSize: 80 }}>👤</Text>}
      </View>
      <View style={{ gap: 4 }}>
        <Text style={{ color: Brand.magenta, fontWeight: '700', textTransform: 'uppercase', fontSize: 12, letterSpacing: 1 }}>{staff.category_name}</Text>
        <Text style={{ fontSize: 26, fontWeight: '800', color: Brand.navy }}>{staff.full_name}</Text>
        {(staff.rating_count ?? 0) > 0 && (
          <Muted>
            ★ {Number(staff.rating_avg).toFixed(1)} · {staff.rating_count} review{staff.rating_count === 1 ? '' : 's'}
          </Muted>
        )}
      </View>
      {badges.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {badges.map((b) => (
            <Text key={b} style={{ color: Brand.magentaDark, backgroundColor: Brand.magentaSoft, fontWeight: '700', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, overflow: 'hidden' }}>
              ✓ {b}
            </Text>
          ))}
        </View>
      )}
      <Card>
        <Row label="Area" value={staff.location_text} />
        <Row label="Arrangement" value={staff.live_arrangement ? LIVE_LABEL[staff.live_arrangement] : null} />
        <Row label="Experience" value={staff.years_experience != null ? `${staff.years_experience} years` : null} />
        <Row label="Languages" value={staff.languages?.join(', ')} />
        <Row label="Monthly rate" value={staff.month_rate ? formatKes(staff.month_rate) : null} />
        <Row label="Daily rate" value={staff.day_rate ? formatKes(staff.day_rate) : null} />
      </Card>
      {staff.bio && (
        <Card>
          <Text style={{ fontWeight: '700', color: Brand.navy }}>About {first}</Text>
          <Muted>{staff.bio}</Muted>
          {!!staff.skills?.length && <Muted>Skills: {staff.skills.join(', ')}</Muted>}
        </Card>
      )}
      <Button title={staff.availability === 'available' ? `Request ${first}` : `Join ${first}'s waiting list`} onPress={() => router.push(`/book?staff=${staff.id}`)} />
      <Card>
        <Text style={{ fontWeight: '700', color: Brand.navy }}>What clients say</Text>
        {reviews.length ? (
          reviews.map((r) => (
            <View key={r.id} style={{ borderTopWidth: 1, borderTopColor: Brand.line, paddingTop: 8, gap: 2 }}>
              <Text style={{ color: Brand.gold }}>{'★'.repeat(r.stars ?? 0)}{'☆'.repeat(5 - (r.stars ?? 0))}</Text>
              {r.comment && <Text style={{ color: Brand.navy }}>“{r.comment}”</Text>}
              <Muted style={{ fontSize: 12 }}>
                {r.client_first_name} · {formatDate(r.created_at)}
              </Muted>
            </View>
          ))
        ) : (
          <Muted>No reviews yet.</Muted>
        )}
      </Card>
    </Screen>
  )
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
      <Muted>{label}</Muted>
      <Text style={{ color: Brand.navy, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>{value}</Text>
    </View>
  )
}
