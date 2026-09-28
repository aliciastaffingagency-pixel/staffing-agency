import { settleCard, verifyPaystackSignature } from '@/lib/payments'

// Paystack server-to-server event. Signed with HMAC-SHA512 of the raw body.
export async function POST(request: Request) {
  const raw = await request.text()
  if (!verifyPaystackSignature(raw, request.headers.get('x-paystack-signature'))) {
    return new Response('invalid signature', { status: 401 })
  }
  const event = JSON.parse(raw) as { event?: string; data?: { reference?: string } }
  if (event.event === 'charge.success' && event.data?.reference) {
    await settleCard(event.data.reference)
  }
  return new Response('ok')
}
