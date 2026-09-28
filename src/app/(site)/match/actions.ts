'use server'

import { z } from 'zod'
import { getSession } from '@/lib/auth'
import { rateLimit } from '@/lib/rate-limit'
import { runMatch, type MatchResponse } from '@/lib/services/match'

export type MatchState = { error?: string; query?: string; result?: MatchResponse }

export async function findMatches(_prev: MatchState, formData: FormData): Promise<MatchState> {
  const parsed = z.string().trim().min(8, 'Tell us a little more about who you need').max(800).safeParse(formData.get('query'))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!(await rateLimit('match', 12, 600))) return { query: parsed.data, error: 'Too many searches. Please wait a few minutes and try again.' }
  const session = await getSession()
  return { query: parsed.data, result: await runMatch(parsed.data, session?.id ?? null) }
}
