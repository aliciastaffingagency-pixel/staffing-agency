import 'server-only'
import { STAFF_CARD_COLUMNS, type StaffCardData } from '@/components/staff/staff-card'
import { aiEnabled, aiMatch } from '@/lib/ai'
import { getAgency, getCategories } from '@/lib/agency'
import { loadCandidates, rulesMatch, type MatchResult } from '@/lib/matching'
import { createAdminClient } from '@/lib/supabase/admin'

export type MatchResponse = Omit<MatchResult, 'matches'> & { matches: { staff: StaffCardData; reason: string }[] }

// AI when configured (falls back to rules on any failure), logged for demand analytics.
export async function runMatch(query: string, userId: string | null): Promise<MatchResponse> {
  const [agency, categories] = await Promise.all([getAgency(), getCategories()])
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
    user_id: userId,
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
    ...result,
    matches: result.matches.flatMap((m) => {
      const staff = byId.get(m.staff_id)
      return staff ? [{ staff, reason: m.reason }] : []
    }),
  }
}
