import { Image } from 'expo-image'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Brand, STATUS_COLORS } from '@/constants/brand'
import { formatKes, LIVE_LABEL } from '@/lib/format'

export function Screen({ children, scroll = true, refreshControl }: { children: React.ReactNode; scroll?: boolean; refreshControl?: React.ReactElement }) {
  return (
    <SafeAreaView style={s.screen} edges={['left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" refreshControl={refreshControl as never}>
          {children}
        </ScrollView>
      ) : (
        <View style={[s.content, { flex: 1 }]}>{children}</View>
      )}
    </SafeAreaView>
  )
}

export function H1({ children }: { children: React.ReactNode }) {
  return <Text style={s.h1}>{children}</Text>
}

export function Muted({ children, style }: { children: React.ReactNode; style?: object }) {
  return <Text style={[s.muted, style]}>{children}</Text>
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[s.card, style]}>{children}</View>
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  busy,
  disabled,
}: {
  title: string
  onPress: () => void
  variant?: 'primary' | 'navy' | 'outline' | 'whatsapp' | 'danger'
  busy?: boolean
  disabled?: boolean
}) {
  const bg = { primary: Brand.magenta, navy: Brand.navy, outline: Brand.white, whatsapp: '#25D366', danger: Brand.red }[variant]
  const fg = variant === 'outline' ? Brand.navy : Brand.white
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [s.button, { backgroundColor: bg, opacity: busy || disabled ? 0.6 : pressed ? 0.85 : 1 }, variant === 'outline' && s.outline]}
    >
      {busy ? <ActivityIndicator color={fg} /> : <Text style={[s.buttonText, { color: fg }]}>{title}</Text>}
    </Pressable>
  )
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor={Brand.navyMuted} {...props} style={[s.input, props.multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 }]} />
    </View>
  )
}

export function Alert({ error, message }: { error?: string | null; message?: string | null }) {
  if (!error && !message) return null
  return (
    <View style={[s.alert, { backgroundColor: error ? Brand.redSoft : Brand.greenSoft }]} accessibilityLiveRegion="polite">
      <Text style={{ color: error ? Brand.red : Brand.green }}>{error ?? message}</Text>
    </View>
  )
}

export function StatusPill({ status }: { status: string }) {
  const c = STATUS_COLORS[status] ?? { bg: Brand.line, fg: Brand.navySoft }
  return (
    <View style={[s.pill, { backgroundColor: c.bg }]}>
      <Text style={[s.pillText, { color: c.fg }]}>{status.replaceAll('_', ' ')}</Text>
    </View>
  )
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <View style={s.empty}>
      <Text style={s.muted}>{children}</Text>
    </View>
  )
}

export function Loading() {
  return <ActivityIndicator color={Brand.magenta} style={{ marginTop: 40 }} />
}

export type StaffRow = {
  id: string | null
  full_name: string | null
  photo_url: string | null
  category_name: string | null
  location_text: string | null
  live_arrangement: keyof typeof LIVE_LABEL | null
  month_rate: number | null
  day_rate: number | null
  rating_avg: number | null
  rating_count: number | null
  verified_badge: boolean | null
  trained_badge: boolean | null
  background_checked_badge: boolean | null
}

export function StaffItem({ s: st, onPress, selected }: { s: StaffRow; onPress?: () => void; selected?: boolean }) {
  const rate = st.month_rate ?? st.day_rate
  const badges = [st.verified_badge && 'Verified', st.background_checked_badge && 'Background-checked', st.trained_badge && 'Trained'].filter(Boolean) as string[]
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [s.staff, selected && { borderColor: Brand.magenta, borderWidth: 2 }, pressed && { opacity: 0.85 }]}>
      <View style={s.avatar}>
        {st.photo_url ? <Image source={{ uri: st.photo_url }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <Text style={{ fontSize: 26 }}>👤</Text>}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text style={s.staffName} numberOfLines={1}>{st.full_name}</Text>
          {(st.rating_count ?? 0) > 0 && <Text style={s.rating}>★ {Number(st.rating_avg).toFixed(1)}</Text>}
        </View>
        <Text style={s.muted} numberOfLines={1}>
          {[st.category_name, st.location_text, st.live_arrangement && LIVE_LABEL[st.live_arrangement]].filter(Boolean).join(' · ')}
        </Text>
        {rate != null && <Text style={s.rate}>{formatKes(rate)} / {st.month_rate ? 'month' : 'day'}</Text>}
        {badges.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {badges.map((b) => (
              <Text key={b} style={s.badge}>✓ {b}</Text>
            ))}
          </View>
        )}
      </View>
    </Pressable>
  )
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Brand.cream },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  h1: { fontSize: 26, fontWeight: '800', color: Brand.navy },
  muted: { color: Brand.navySoft, fontSize: 14, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600', color: Brand.navy },
  card: { backgroundColor: Brand.white, borderRadius: 24, borderWidth: 1, borderColor: Brand.border, padding: 16, gap: 10 },
  button: { minHeight: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22 },
  outline: { borderWidth: 2, borderColor: Brand.line },
  buttonText: { fontSize: 16, fontWeight: '700' },
  input: { minHeight: 50, borderRadius: 16, borderWidth: 1, borderColor: Brand.line, backgroundColor: Brand.white, paddingHorizontal: 14, fontSize: 16, color: Brand.navy },
  alert: { borderRadius: 16, padding: 12 },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  empty: { borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', borderColor: Brand.border, padding: 24, alignItems: 'center' },
  staff: { flexDirection: 'row', gap: 12, backgroundColor: Brand.white, borderRadius: 20, borderWidth: 1, borderColor: Brand.border, padding: 12 },
  avatar: { width: 64, height: 64, borderRadius: 16, overflow: 'hidden', backgroundColor: Brand.magentaSoft, alignItems: 'center', justifyContent: 'center' },
  staffName: { fontSize: 16, fontWeight: '700', color: Brand.navy, flexShrink: 1 },
  rating: { fontSize: 13, fontWeight: '700', color: Brand.navy },
  rate: { fontSize: 14, fontWeight: '700', color: Brand.navy },
  badge: { fontSize: 11, fontWeight: '700', color: Brand.magentaDark, backgroundColor: Brand.magentaSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
})
