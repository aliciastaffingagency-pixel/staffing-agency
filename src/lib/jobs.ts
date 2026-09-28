import type { Enums } from '@/lib/supabase/database.types'
import { formatKes } from '@/lib/utils'

export const EMPLOYMENT_LABEL: Record<Enums<'employment_type'>, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  temporary: 'Temporary',
  casual: 'Casual / day work',
}

export const ENGAGEMENT_LABEL: Record<Enums<'engagement_preference'>, { title: string; short: string; text: string }> = {
  join_agency: {
    title: 'Join the agency as a member',
    short: 'Join agency',
    text: 'Become part of the Alicia team. We vet you, place you with clients and support you on the job.',
  },
  own_terms: {
    title: 'Agree my own terms with the owner',
    short: 'Own terms',
    text: 'Tell us the pay, hours and arrangement you prefer and we’ll discuss terms directly.',
  },
}

export const APPLICATION_STATUSES = ['new', 'reviewing', 'shortlisted', 'interview', 'accepted', 'rejected', 'withdrawn'] as const

// Suggestions in the admin form; the owner can type any other document name.
export const DOCUMENT_SUGGESTIONS = [
  'National ID',
  'CV / Résumé',
  'Certificate of good conduct',
  'Reference letter',
  'Training certificate',
  'Medical certificate',
  'Passport photo',
  'Driving licence',
]

// For general applications (not tied to a vacancy).
export const GENERAL_DOCUMENTS = ['National ID', 'CV / Résumé']

export const MAX_EXTRA_DOCUMENTS = 3
export const APPLICATION_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
export const APPLICATION_MAX_MB = 10

export function payRange(min: number | null, max: number | null, period: Enums<'rate_period'>) {
  if (min == null && max == null) return null
  const per = period === 'month' ? '/ month' : '/ day'
  if (min != null && max != null && min !== max) return `${formatKes(min)} – ${formatKes(max)} ${per}`
  return `${formatKes(min ?? max)} ${per}`
}
