import { z } from 'zod'
import { apiContext } from '@/lib/api-auth'
import { clientIp } from '@/lib/rate-limit'
import { createBookingOp, payMpesaOp, sendMessageOp, signContractOp, startThreadOp, submitRatingOp } from '@/lib/services/client-ops'
import { deleteClientAccount } from '@/lib/services/erasure'

// JSON API for the Expo app. Every operation reuses the same service code as the website.
//   POST /api/mobile/{bookings|sign|pay|threads|messages|ratings|push-token|delete-account}
export async function POST(request: Request, { params }: RouteContext<'/api/mobile/[op]'>) {
  const ctx = await apiContext(request)
  if (!ctx) return Response.json({ error: 'Please sign in again.' }, { status: 401 })
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
  const { op } = await params

  switch (op) {
    case 'bookings':
      return reply(await createBookingOp(ctx, body))
    case 'sign':
      return reply(await signContractOp(ctx, body, await clientIp()))
    case 'pay':
      return reply(await payMpesaOp(ctx, body))
    case 'threads':
      return reply(await startThreadOp(ctx, body))
    case 'messages':
      return reply(await sendMessageOp(ctx, String(body.thread_id ?? ''), String(body.body ?? '')))
    case 'ratings':
      return reply(await submitRatingOp(ctx, body))
    case 'push-token': {
      const parsed = z
        .object({ token: z.string().regex(/^Expo(nent)?PushToken\[.+\]$/), platform: z.enum(['ios', 'android', 'web']).optional() })
        .safeParse(body)
      if (!parsed.success) return Response.json({ error: 'Invalid push token' }, { status: 400 })
      const { error } = await ctx.supabase
        .from('push_tokens')
        .upsert({ user_id: ctx.session.id, token: parsed.data.token, platform: parsed.data.platform ?? null, last_seen_at: new Date().toISOString() }, { onConflict: 'token' })
      return reply(error ? { error: error.message } : { ok: true })
    }
    case 'delete-account': {
      // Google Play requires in-app account deletion. Same rules as the website.
      if (String(body.confirm ?? '').toUpperCase() !== 'DELETE') return Response.json({ error: 'Type DELETE to confirm.' }, { status: 400 })
      if (ctx.session.role !== 'client') return Response.json({ error: 'Only client accounts can be deleted in the app.' }, { status: 403 })
      return reply(await deleteClientAccount(ctx.session.id, 'self'))
    }
    default:
      return Response.json({ error: 'Unknown operation' }, { status: 404 })
  }
}

function reply(res: { error?: string } & Record<string, unknown>) {
  return Response.json(res, { status: res.error ? 400 : 200 })
}
