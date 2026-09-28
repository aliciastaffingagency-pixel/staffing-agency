import { NextResponse, type NextRequest } from 'next/server'
import { settleCard } from '@/lib/payments'
import { createAdminClient } from '@/lib/supabase/admin'

// Where Paystack sends the browser after checkout. We verify with Paystack
// directly and then send the client back to their booking.
export async function GET(request: NextRequest) {
  const reference = request.nextUrl.searchParams.get('reference') ?? request.nextUrl.searchParams.get('trxref')
  const back = new URL('/account', request.url)
  if (!reference) return NextResponse.redirect(back)
  try {
    const { ok, contractId } = await settleCard(reference)
    if (contractId) {
      const { data } = await createAdminClient().from('contracts').select('booking_request_id').eq('id', contractId).single()
      if (data) back.pathname = `/account/bookings/${data.booking_request_id}`
    }
    back.searchParams.set('payment', ok ? 'success' : 'pending')
  } catch (e) {
    console.error('paystack return failed', e)
    back.searchParams.set('payment', 'pending')
  }
  return NextResponse.redirect(back)
}
