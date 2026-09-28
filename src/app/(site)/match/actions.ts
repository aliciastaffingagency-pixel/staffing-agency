'use server'

import { z } from 'zod'
import type { StaffCardData } from '@/components/staff/staff-card'
import { STAFF_CARD_COLUMNS } from '@/components/staff/staff-card'
import { aiEnabled, aiMatch } from '@/lib/ai'
import { getAgency, getCategories } from '@/lib/agency'
import { getSession } from '@/lib/auth'
import { loadCandidates, rulesMatch, type MatchResult } from '@/lib/matching'
import { rateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'

export type MatchState = {
  error?: string
  query?: string
  result?: Omit<MatchResult, 'matches'> & { matches: { staff: StaffCardData; reason: string }[] }
}

export async function findMatches(_prev: MatchState, formData: FormData): Promise<MatchState> {
  const parsed = z.string().trim().min(8, 'Tell us a little more about who you need').max(800).safeParse(formData.get('query'))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const query = parsed.data
  if (!(await rateLimit('match', 12, 600))) return { query, error: 'Too many searches. Please wait a few minutes and try again.' }

  const [agency, categories, session] = await Promise.all([getAgency(), getCategories(), getSession()])
  const candidates = await loadCandidates(agency.id)
  const cats = categories.map((c) => ({ slug: c.slug, name: c.name }))

  let result: MatchResult | null = null
  if (aiEnabled() && candidates.length) {
    try {
      result = await aiMatch(query, candidates, cats, agency.name)
    } catch (e) {
      console.error('AI match failed, using rules', e)
    }
  }
  result ??= rulesMatch(query, candidates, cats)

  const admin = createAdminClient()
  await admin.from('match_queries').insert({
    agency_id: agency.id,
    user_id: session?.id ?? null,
    query,
    category_slug: result.category_slug,
    area: result.area,
    results: result.matches.length,
    engine: result.engine,
  })

  const ids = result.matches.map((m) => m.staff_id)
  const { data: rows } = ids.length ? await admin.from('staff_catalog').select(STAFF_CARD_COLUMNS).in('id', ids) : { data: [] }
  const byId = new Map((rows ?? []).map((r) => [r.id, r]))
  return {
    query,
    result: {
      ...result,
      matches: result.matches.flatMap((m) => {
        const staff = byId.get(m.staff_id)
        return staff ? [{ staff, reason: m.reason }] : []
      }),
    },
  }
}
