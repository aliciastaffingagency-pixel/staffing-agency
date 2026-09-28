import { router, useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Pressable, Switch, Text, View } from 'react-native'
import { Alert, Button, Card, Field, Loading, Muted, Screen, StatusPill } from '@/components/ui'
import { Brand } from '@/constants/brand'
import { api } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { formatDate, formatKes, LIVE_LABEL } from '@/lib/format'
import { supabase, type Database } from '@/lib/supabase'

type Booking = Database['public']['Tables']['booking_requests']['Row'] & { staff_categories: { name: string } | null; staff_profiles: { full_name: string } | null }
type Contract = Database['public']['Tables']['contracts']['Row']
type Payment = { id: string; amount: number; method: string; status: string; mpesa_receipt: string | null; created_at: string }

const STEPS = ['Requested', 'Matched', 'Signed', 'Paid', 'Active']
const REQUESTS = [
  { kind: 'replacement', label: 'Request a replacement' },
  { kind: 'dispute', label: 'Report an issue' },
  { kind: 'extension', label: 'Extend the contract' },
  { kind: 'end_request', label: 'End the contract' },
] as const

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { profile } = useAuth()
  const [b, setB] = useState<Booking | null>(null)
  const [contract, setContract] = useState<Contract | null>(null)
  const [payments, setPayments] = useState<Payment[]>([])
  const [rated, setRated] = useState(false)

  const load = useCallback(async () => {
    const [{ data: booking }, { data: contracts }] = await Promise.all([
      supabase.from('booking_requests').select('*, staff_categories(name), staff_profiles(full_name)').eq('id', id).maybeSingle(),
      supabase.from('contracts').select('*').eq('booking_request_id', id).neq('status', 'cancelled').order('created_at', { ascending: false }).limit(1),
    ])
    setB(booking as Booking | null)
    const c = contracts?.[0] ?? null
    setContract(c)
    if (c) {
      const [{ data: p }, { data: r }] = await Promise.all([
        supabase.from('payments').select('id, amount, method, status, mpesa_receipt, created_at').eq('contract_id', c.id).order('created_at', { ascending: false }),
        supabase.from('ratings').select('id').eq('contract_id', c.id).maybeSingle(),
      ])
      setPayments(p ?? [])
      setRated(Boolean(r))
    }
  }, [id])

  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  if (!b) return <Loading />
  const paid = payments.filter((p) => p.status === 'paid').reduce((s, p) => s + Number(p.amount), 0)
  const outstanding = Math.max(0, Number(contract?.amount_due ?? 0) - paid)
  const reached = [true, Boolean(b.staff_id), Boolean(contract?.client_signed_at), Boolean(contract?.client_signed_at) && outstanding === 0, b.status === 'active' || b.status === 'completed']
  const terms = (contract?.terms_json ?? {}) as { body?: string }
  const placed = contract && ['active', 'ended'].includes(contract.status)

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 22, fontWeight: '800', color: Brand.navy, flexShrink: 1 }}>{b.staff_categories?.name ?? 'Staff request'}</Text>
        <StatusPill status={b.status} />
      </View>
      <Muted>
        {b.location_text} {b.live_arrangement ? `· ${LIVE_LABEL[b.live_arrangement]}` : ''} · requested {formatDate(b.created_at)}
      </Muted>

      {b.status !== 'cancelled' && (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} accessibilityLabel="Progress">
          {STEPS.map((label, i) => (
            <View key={label} style={{ alignItems: 'center', gap: 4, flex: 1 }}>
              <View style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: reached[i] ? Brand.magenta : Brand.white, borderWidth: 1, borderColor: reached[i] ? Brand.magenta : Brand.line }}>
                <Text style={{ color: reached[i] ? Brand.white : Brand.navyMuted, fontWeight: '700' }}>{reached[i] ? '✓' : i + 1}</Text>
              </View>
              <Text style={{ fontSize: 11, color: reached[i] ? Brand.navy : Brand.navyMuted }}>{label}</Text>
            </View>
          ))}
        </View>
      )}

      {b.staff_profiles && (
        <Card>
          <Muted>Your staff member</Muted>
          <Pressable onPress={() => router.push(`/staff/${b.staff_id}`)}>
            <Text style={{ fontSize: 18, fontWeight: '700', color: Brand.magenta }}>{b.staff_profiles.full_name} →</Text>
          </Pressable>
        </Card>
      )}

      {!contract && b.status !== 'cancelled' && (
        <Card>
          <Muted>{b.staff_id ? 'We’re preparing your contract. You’ll get a notification when it’s ready.' : 'We’re finding the best match for you. You’ll get a notification once we’ve confirmed someone.'}</Muted>
        </Card>
      )}

      {contract && (
        <Card>
          <Text style={{ fontWeight: '700', color: Brand.navy, fontSize: 16 }}>Your contract</Text>
          <Muted>
            Staff pay {contract.rate ? `${formatKes(contract.rate)} / ${contract.rate_period}` : 'as agreed'} · Agency fee {formatKes(contract.amount_due ?? 0)}
          </Muted>
          <Text style={{ color: Brand.navy, lineHeight: 21, fontSize: 14 }}>{terms.body}</Text>
          <Muted>
            Client: {contract.client_signature ? `${contract.client_signature}, ${formatDate(contract.client_signed_at)}` : 'not signed'} · Agency:{' '}
            {contract.admin_signature ? `${contract.admin_signature}, ${formatDate(contract.admin_signed_at)}` : 'not signed'}
          </Muted>
          {contract.status === 'sent' && <SignForm contractId={contract.id} defaultName={profile?.full_name ?? ''} onDone={load} />}
        </Card>
      )}

      {contract && ['client_signed', 'fully_signed', 'active'].includes(contract.status) && outstanding > 0 && (
        <PayForm contractId={contract.id} amount={outstanding} defaultPhone={profile?.phone ?? ''} onPaid={load} />
      )}

      {payments.length > 0 && (
        <Card>
          <Text style={{ fontWeight: '700', color: Brand.navy }}>Payments</Text>
          {payments.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: Brand.navy }}>
                {formatKes(p.amount)} · {p.method.toUpperCase()} {p.mpesa_receipt ?? ''}
              </Text>
              <StatusPill status={p.status} />
            </View>
          ))}
        </Card>
      )}

      {placed && b.staff_id && !rated && <RateForm staffId={b.staff_id} contractId={contract!.id} name={b.staff_profiles?.full_name?.split(' ')[0] ?? 'them'} onDone={() => setRated(true)} />}

      {placed && (
        <Card>
          <Text style={{ fontWeight: '700', color: Brand.navy }}>Need something?</Text>
          <RequestForm bookingId={b.id} active={contract!.status === 'active'} />
        </Card>
      )}
    </Screen>
  )
}

function SignForm({ contractId, defaultName, onDone }: { contractId: string; defaultName: string; onDone: () => void }) {
  const [agree, setAgree] = useState(false)
  const [name, setName] = useState(defaultName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <View style={{ gap: 10, borderTopWidth: 1, borderTopColor: Brand.line, paddingTop: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Switch value={agree} onValueChange={setAgree} trackColor={{ true: Brand.magenta }} accessibilityLabel="I agree to the terms" />
        <Text style={{ color: Brand.navy, flex: 1 }}>I have read and agree to the terms above.</Text>
      </View>
      <Field label="Type your full name to sign" value={name} onChangeText={setName} />
      <Alert error={error} />
      <Button
        title="Sign contract"
        busy={busy}
        disabled={!agree || name.trim().length < 3}
        onPress={async () => {
          setBusy(true)
          setError(null)
          try {
            await api.op('sign', { contract_id: contractId, signature: name, agree: true })
            onDone()
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not sign')
          } finally {
            setBusy(false)
          }
        }}
      />
    </View>
  )
}

function PayForm({ contractId, amount, defaultPhone, onPaid }: { contractId: string; amount: number; defaultPhone: string; onPaid: () => void }) {
  const [phone, setPhone] = useState(defaultPhone)
  const [busy, setBusy] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Poll for the M-Pesa callback while the prompt is on the phone (~2 minutes).
  useEffect(() => {
    if (!waiting) return
    let n = 0
    const t = setInterval(() => {
      n += 1
      onPaid()
      if (n > 30) setWaiting(false)
    }, 4000)
    return () => clearInterval(t)
  }, [waiting, onPaid])

  return (
    <Card style={{ borderColor: Brand.magenta, borderWidth: 2 }}>
      <Text style={{ fontWeight: '700', color: Brand.navy, fontSize: 16 }}>Pay {formatKes(amount)} to confirm your placement</Text>
      <Field label="M-Pesa phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      <Alert error={error} message={message} />
      {waiting && <Muted>Waiting for M-Pesa confirmation…</Muted>}
      <Button
        title="Pay with M-Pesa"
        variant="whatsapp"
        busy={busy}
        onPress={async () => {
          setBusy(true)
          setError(null)
          try {
            const res = await api.op<{ message: string }>('pay', { contract_id: contractId, phone })
            setMessage(res.message)
            setWaiting(true)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not start the payment')
          } finally {
            setBusy(false)
          }
        }}
      />
    </Card>
  )
}

function RateForm({ staffId, contractId, name, onDone }: { staffId: string; contractId: string; name: string; onDone: () => void }) {
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <Card>
      <Text style={{ fontWeight: '700', color: Brand.navy }}>How was {name}?</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable key={n} onPress={() => setStars(n)} accessibilityRole="button" accessibilityLabel={`${n} stars`} hitSlop={6}>
            <Text style={{ fontSize: 34, color: n <= stars ? Brand.gold : Brand.line }}>★</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Your review (optional)" value={comment} onChangeText={setComment} multiline maxLength={2000} />
      <Alert error={error} />
      <Button
        title="Submit review"
        busy={busy}
        disabled={!stars}
        onPress={async () => {
          setBusy(true)
          setError(null)
          try {
            await api.op('ratings', { staff_id: staffId, contract_id: contractId, stars, comment })
            onDone()
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not submit')
          } finally {
            setBusy(false)
          }
        }}
      />
    </Card>
  )
}

function RequestForm({ bookingId, active }: { bookingId: string; active: boolean }) {
  const kinds = active ? REQUESTS : REQUESTS.filter((r) => r.kind === 'dispute')
  const [kind, setKind] = useState<string>(kinds[0].kind)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {kinds.map((k) => (
          <Pressable
            key={k.kind}
            onPress={() => setKind(k.kind)}
            accessibilityRole="button"
            accessibilityState={{ selected: kind === k.kind }}
            style={{ borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: kind === k.kind ? Brand.navy : Brand.white, borderWidth: 1, borderColor: Brand.line }}
          >
            <Text style={{ color: kind === k.kind ? Brand.white : Brand.navy, fontSize: 13, fontWeight: '600' }}>{k.label}</Text>
          </Pressable>
        ))}
      </View>
      <Field label="Message" value={body} onChangeText={setBody} multiline maxLength={5000} />
      <Alert error={error} />
      <Button
        title="Send to the agency"
        variant="navy"
        busy={busy}
        disabled={body.trim().length < 5}
        onPress={async () => {
          setBusy(true)
          setError(null)
          try {
            const { threadId } = await api.op<{ threadId: string }>('threads', { kind, body, booking_id: bookingId })
            router.push(`/messages/${threadId}`)
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not send')
          } finally {
            setBusy(false)
          }
        }}
      />
    </View>
  )
}
