import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Pressable, Text, View } from 'react-native'
import { Alert, Button, Field, Muted, Screen, StaffItem, type StaffRow } from '@/components/ui'
import { Brand } from '@/constants/brand'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'

type Category = { id: string; name: string }
type Live = 'either' | 'live_in' | 'live_out'

// Choose a service → see who's available in it → pick someone (or let the agency choose).
export default function Book() {
  const params = useLocalSearchParams<{ staff?: string; category?: string }>()
  const [categories, setCategories] = useState<Category[]>([])
  const [category, setCategory] = useState<string>(params.category ?? '')
  const [loaded, setLoaded] = useState<{ category: string; people: (StaffRow & { category_id: string | null })[] }>({ category: '', people: [] })
  const people = loaded.category === category ? loaded.people : []
  const [picked, setPicked] = useState<string>(params.staff ?? '')
  const [live, setLive] = useState<Live>('either')
  const [area, setArea] = useState('')
  const [budget, setBudget] = useState('')
  const [startDate, setStartDate] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('staff_categories').select('id, name').eq('is_active', true).order('sort_order').then(({ data }) => setCategories(data ?? []))
    supabase.from('clients').select('location_text').maybeSingle().then(({ data }) => data?.location_text && setArea(data.location_text))
    if (params.staff) {
      supabase.from('staff_catalog').select('category_id').eq('id', params.staff).maybeSingle().then(({ data }) => data?.category_id && setCategory(data.category_id))
    }
  }, [params.staff])

  useEffect(() => {
    if (!category) return
    supabase
      .from('staff_catalog')
      .select('*')
      .eq('category_id', category)
      .eq('availability', 'available')
      .order('rating_avg', { ascending: false })
      .limit(50)
      .then(({ data }) => setLoaded({ category, people: (data ?? []) as never }))
  }, [category])

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      const { bookingId } = await api.op<{ bookingId: string }>('bookings', {
        category_id: category,
        staff_id: picked,
        live_arrangement: live,
        location_text: area,
        budget,
        start_date: /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? startDate : '',
        notes,
      })
      router.replace(`/bookings/${bookingId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not send your request')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Screen>
      <Text style={{ fontWeight: '700', color: Brand.navy }}>What kind of help do you need?</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {categories.map((c) => (
          <Chip key={c.id} label={c.name} on={category === c.id} onPress={() => { setCategory(c.id); setPicked('') }} />
        ))}
      </View>

      {!!category && (
        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: '700', color: Brand.navy }}>Choose who you&apos;d like ({people.length} available)</Text>
          <Pressable
            onPress={() => setPicked('')}
            accessibilityRole="radio"
            accessibilityState={{ selected: picked === '' }}
            style={{ padding: 14, borderRadius: 20, borderWidth: 2, borderColor: picked === '' ? Brand.magenta : Brand.line, backgroundColor: picked === '' ? Brand.magentaSoft : Brand.white }}
          >
            <Text style={{ fontWeight: '700', color: Brand.navy }}>✨ Let the agency choose for me</Text>
            <Muted>We&apos;ll pick the best match for your needs and budget.</Muted>
          </Pressable>
          {people.map((p) => (
            <StaffItem key={p.id} s={p} selected={picked === p.id} onPress={() => setPicked(p.id!)} />
          ))}
        </View>
      )}

      <Text style={{ fontWeight: '700', color: Brand.navy }}>Live-in or live-out?</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['either', 'live_in', 'live_out'] as const).map((l) => (
          <Chip key={l} label={{ either: 'Either', live_in: 'Live-in', live_out: 'Live-out' }[l]} on={live === l} onPress={() => setLive(l)} />
        ))}
      </View>
      <Field label="Where is the job?" value={area} onChangeText={setArea} placeholder="e.g. Kilimani, Nairobi" />
      <Field label="Monthly budget (KES, optional)" value={budget} onChangeText={setBudget} keyboardType="number-pad" />
      <Field label="Preferred start date (optional, YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} placeholder="2026-10-15" />
      <Field label="Tell us about the job" value={notes} onChangeText={setNotes} multiline maxLength={3000} placeholder="Household size, children's ages, duties, working days…" />
      <Alert error={error} />
      <Button title="Send request" onPress={submit} busy={busy} disabled={!category || area.trim().length < 2} />
      <Muted>No payment now. We confirm the match first, then send a digital contract to sign.</Muted>
    </Screen>
  )
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: on ? Brand.magenta : Brand.white, borderWidth: 1, borderColor: on ? Brand.magenta : Brand.line }}
    >
      <Text style={{ color: on ? Brand.white : Brand.navy, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  )
}
