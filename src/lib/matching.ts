import 'server-only'
import { distanceKm, matchArea } from '@/lib/areas'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatKes } from '@/lib/utils'

// Public-safe view of a staff member, as used by both matchers.
export type Candidate = {
  id: string
  name: string
  category: string
  category_slug: string
  area: string | null
  coords: [number, number] | null
  live: 'live_in' | 'live_out' | 'either'
  monthly: number | null // month rate, or day rate × 26
  month_rate: number | null
  day_rate: number | null
  years: number | null
  skills: string[]
  languages: string[]
  bio: string | null
  rating: number
  reviews: number
  verified: boolean
  trained: boolean
  background_checked: boolean
}

export type Match = { staff_id: string; reason: string }
export type MatchResult = { matches: Match[]; summary: string; follow_up: string | null; engine: 'ai' | 'rules'; category_slug: string | null; area: string | null }

export async function loadCandidates(agencyId: string): Promise<Candidate[]> {
  const { data } = await createAdminClient()
    .from('staff_catalog')
    .select('id, full_name, category_name, category_slug, location_text, approx_lat, approx_lng, live_arrangement, month_rate, day_rate, years_experience, skills, languages, bio, rating_avg, rating_count, verified_badge, trained_badge, background_checked_badge, availability')
    .eq('agency_id', agencyId)
    .eq('availability', 'available')
    .limit(500)
  return (data ?? []).map((s) => {
    const area = matchArea(s.location_text)
    return {
      id: s.id!,
      name: s.full_name!,
      category: s.category_name!,
      category_slug: s.category_slug!,
      area: s.location_text,
      coords: s.approx_lat != null && s.approx_lng != null ? [s.approx_lat, s.approx_lng] : (area?.coords ?? null),
      live: s.live_arrangement ?? 'either',
      monthly: s.month_rate ?? (s.day_rate != null ? s.day_rate * 26 : null),
      month_rate: s.month_rate,
      day_rate: s.day_rate,
      years: s.years_experience,
      skills: s.skills ?? [],
      languages: s.languages ?? [],
      bio: s.bio,
      rating: Number(s.rating_avg ?? 0),
      reviews: s.rating_count ?? 0,
      verified: Boolean(s.verified_badge),
      trained: Boolean(s.trained_badge),
      background_checked: Boolean(s.background_checked_badge),
    }
  })
}

// Words people use for each seeded role. Admin-created categories still match by their own name.
const SYNONYMS: Record<string, string[]> = {
  'house-help': ['house help', 'househelp', 'house girl', 'housegirl', 'maid', 'domestic', 'mama fua', 'helper'],
  nanny: ['nanny', 'babysit', 'baby sit', 'toddler', 'toddlers', 'baby', 'babies', 'children', 'kids', 'child', 'childcare'],
  cleaner: ['cleaner', 'cleaning', 'deep clean', 'clean'],
  caregiver: ['caregiver', 'care giver', 'elderly', 'elder', 'grandmother', 'grandfather', 'grandma', 'granny', 'patient', 'nurse aide'],
  'cook-chef': ['cook', 'chef', 'cooking', 'meals', 'meal prep', 'kitchen'],
  'laundry-ironing': ['laundry', 'ironing', 'washing clothes'],
  'house-manager': ['house manager', 'housekeeper', 'estate manager'],
  driver: ['driver', 'driving', 'school run', 'chauffeur'],
  gardener: ['gardener', 'garden', 'shamba', 'lawn', 'compound'],
  'shop-attendant': ['shop attendant', 'shop', 'kiosk', 'store', 'cashier', 'sales'],
  'security-guard': ['security', 'guard', 'watchman', 'askari', 'night guard'],
}

export function parseNeed(query: string, categories: { slug: string; name: string }[]) {
  const q = ` ${query.toLowerCase().replace(/[^a-z0-9,. ]/g, ' ')} `
  let category: string | null = null
  let best = 0
  for (const c of categories) {
    const words = [c.name.toLowerCase(), ...(SYNONYMS[c.slug] ?? [])]
    for (const w of words) {
      if (q.includes(` ${w}`) && w.length > best) {
        best = w.length
        category = c.slug
      }
    }
  }
  const live = /live[\s-]?in|stay[\s-]?in|sleep[\s-]?in/.test(q) ? 'live_in' : /live[\s-]?out|day[\s-]?time only|come daily|go home/.test(q) ? 'live_out' : null
  const budgetMatch = q.match(/(?:ksh|kes|budget|up to|max|around|about|pay)?\s*(\d{1,3}(?:[,.]\d{3})+|\d+(?:\.\d+)?\s*k|\d{4,6})\b/)
  let budget: number | null = null
  if (budgetMatch) {
    const raw = budgetMatch[1].replace(/\s/g, '')
    budget = raw.endsWith('k') ? Number(raw.slice(0, -1)) * 1000 : Number(raw.replace(/[,.]/g, ''))
    if (!(budget >= 1000 && budget <= 500000)) budget = null
  }
  const area = matchArea(query)
  const languages = ['english', 'kiswahili', 'swahili', 'kikuyu', 'luo', 'luhya', 'kamba', 'kalenjin', 'french'].filter((l) => q.includes(` ${l}`))
  return { category, live: live as 'live_in' | 'live_out' | null, budget, area, languages }
}

// Deterministic ranking used when AI is off (or fails). Transparent, explainable reasons.
export function rulesMatch(query: string, candidates: Candidate[], categories: { slug: string; name: string }[]): MatchResult {
  const need = parseNeed(query, categories)
  const words = new Set(query.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3))
  for (const [slug, syns] of Object.entries(SYNONYMS)) if (slug === need.category) syns.forEach((s) => s.split(' ').forEach((w) => w.length > 3 && words.add(w)))

  const scored = candidates
    .filter((c) => !need.category || c.category_slug === need.category)
    .map((c) => {
      let score = c.rating * 3 + Math.min(c.reviews, 10) + (c.verified ? 3 : 0) + (c.background_checked ? 3 : 0) + (c.trained ? 2 : 0)
      const reasons: string[] = []
      if (need.area && c.coords) {
        const km = distanceKm(need.area.coords, c.coords)
        if (km <= 5) {
          score += 20
          reasons.push(`lives near ${need.area.name}`)
        }
        else if (km <= 15) {
          score += 10
          reasons.push(`about ${Math.round(km)} km from ${need.area.name}`)
        }
        else score -= 5
      }
      if (need.live) {
        if (c.live === need.live || c.live === 'either') {
          score += 8
          reasons.push(need.live === 'live_in' ? 'happy to live in' : 'works live-out')
        }
        else score -= 15
      }
      if (need.budget && c.monthly) {
        if (c.monthly <= need.budget) {
          score += 8
          reasons.push(`within your budget at ${formatKes(c.monthly)}/month`)
        }
        else score -= Math.min(20, ((c.monthly - need.budget) / need.budget) * 40)
      }
      // Loose stem match so "cook" finds "Cooking" and "toddlers" finds "Toddler care".
      const stem = (w: string) => w.slice(0, 5)
      const skillHits = c.skills.filter((s) => s.toLowerCase().split(/[^a-z]+/).some((w) => w.length > 3 && [...words].some((q) => stem(q) === stem(w))))
      if (skillHits.length) {
          score += 4 * skillHits.length
          reasons.push(`skilled in ${skillHits.slice(0, 2).join(' and ').toLowerCase()}`)
        }
      const langHits = c.languages.filter((l) => need.languages.some((n) => l.toLowerCase().includes(n === 'swahili' ? 'swahili' : n)))
      if (langHits.length) {
          score += 4
          reasons.push(`speaks ${langHits.join(', ')}`)
        }
      if (c.years && c.years >= 3) reasons.push(`${c.years} years' experience`)
      if (c.reviews > 0) reasons.push(`rated ${c.rating.toFixed(1)}★ by clients`)
      if (c.verified) reasons.push('ID verified')
      return { c, score, reasons }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const cat = categories.find((c) => c.slug === need.category)
  return {
    engine: 'rules',
    category_slug: need.category,
    area: need.area?.name ?? null,
    matches: scored.map(({ c, reasons }) => ({
      staff_id: c.id,
      reason: reasons.length ? `${capitalise(reasons.slice(0, 3).join(', '))}.` : `An available ${c.category.toLowerCase()} on our books.`,
    })),
    summary: scored.length
      ? `Here are the best available ${cat ? cat.name.toLowerCase() : 'staff'} matches${need.area ? ` near ${need.area.name}` : ''}.`
      : `We don't have an available ${cat ? cat.name.toLowerCase() : 'match'} listed right now, but we recruit weekly. Send a request and we'll find someone for you.`,
    follow_up: !need.category ? 'Tell us the role you need (e.g. nanny, cook, driver) for better matches.' : !need.area ? 'Which area is the job in? We can match people who live nearby.' : null,
  }
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
