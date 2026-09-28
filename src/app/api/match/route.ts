import { z } from 'zod'
import { apiContext } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'
import { runMatch } from '@/lib/services/match'

// Smart match for the mobile app (public; the token is optional and only used for logging).
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { query?: unknown }
  const parsed = z.string().trim().min(8, 'Tell us a little more about who you need').max(800).safeParse(body.query)
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 })
  if (!(await rateLimit('match', 12, 600))) return Response.json({ error: 'Too many searches. Please wait a few minutes.' }, { status: 429 })
  const ctx = await apiContext(request)
  return Response.json(await runMatch(parsed.data, ctx?.session.id ?? null))
}
