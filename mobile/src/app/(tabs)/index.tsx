import { router, useFocusEffect } from 'expo-router'
import { useCallback, useState } from 'react'
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { Empty, Loading, Muted, StaffItem, s, type StaffRow } from '@/components/ui'
import { Brand } from '@/constants/brand'
import { supabase } from '@/lib/supabase'

type Category = { id: string; name: string; slug: string }

// Browse available staff by service (same public-safe catalog as the website).
export default function Browse() {
  const [categories, setCategories] = useState<Category[]>([])
  const [category, setCategory] = useState<string | null>(null)
  const [staff, setStaff] = useState<StaffRow[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async () => {
    const [{ data: cats }, catalog] = await Promise.all([
      supabase.from('staff_categories').select('id, name, slug').eq('is_active', true).order('sort_order'),
      (category ? supabase.from('staff_catalog').select('*').eq('category_id', category) : supabase.from('staff_catalog').select('*'))
        .eq('availability', 'available')
        .order('rating_avg', { ascending: false })
        .limit(100),
    ])
    setCategories(cats ?? [])
    setStaff(catalog.data ?? [])
  }, [category])

  // Reload whenever the tab regains focus (e.g. after a booking changes availability).
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  return (
    <View style={s.screen}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, padding: 16, paddingBottom: 4 }}>
        {[{ id: null as string | null, name: 'All' }, ...categories].map((c) => {
          const on = category === c.id
          return (
            <Pressable
              key={c.id ?? 'all'}
              onPress={() => setCategory(c.id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={{ borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: on ? Brand.magenta : Brand.white, borderWidth: 1, borderColor: on ? Brand.magenta : Brand.line }}
            >
              <Text style={{ color: on ? Brand.white : Brand.navy, fontWeight: '600' }}>{c.name}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
      {staff === null ? (
        <Loading />
      ) : (
        <FlatList
          data={staff}
          keyExtractor={(x) => x.id!}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true)
                await load()
                setRefreshing(false)
              }}
              tintColor={Brand.magenta}
            />
          }
          ListHeaderComponent={<Muted>Vetted people available now. Tap someone to see their profile.</Muted>}
          ListEmptyComponent={
            <Empty>
              No one is listed as available here right now. Request anyway and we&apos;ll match you.
            </Empty>
          }
          renderItem={({ item }) => <StaffItem s={item} onPress={() => router.push(`/staff/${item.id}`)} />}
        />
      )}
      <Pressable
        onPress={() => router.push(category ? `/book?category=${category}` : '/book')}
        accessibilityRole="button"
        style={{ position: 'absolute', right: 16, bottom: 16, backgroundColor: Brand.magenta, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 14, elevation: 4 }}
      >
        <Text style={{ color: Brand.white, fontWeight: '700' }}>Request staff</Text>
      </Pressable>
    </View>
  )
}
