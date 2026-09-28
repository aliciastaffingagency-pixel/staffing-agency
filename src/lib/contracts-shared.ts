import type { Json } from '@/lib/supabase/database.types'
import { formatDate, formatKes, LIVE_LABEL } from '@/lib/utils'

export type TemplateDefaults = {
  trial_period_days: number
  notice_period_days: number
  replacement_window_days: number
  max_replacements: number
  confirmed_by_owner?: boolean
}

export type ContractTerms = {
  body: string // fully rendered contract text
  values: Record<string, string>
  defaults: TemplateDefaults
}

export const PLACEHOLDERS = [
  'contract_date', 'agency_name', 'client_name', 'client_location', 'client_phone', 'staff_name', 'staff_role',
  'start_date', 'live_arrangement', 'duties', 'rate', 'rate_period', 'amount_due', 'trial_period_days',
  'notice_period_days', 'replacement_window_days', 'max_replacements',
] as const

export function renderTemplate(body: string, values: Record<string, string>) {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => values[key] ?? '')
}

export function buildValues(input: {
  agencyName: string
  clientName: string | null
  clientLocation: string | null
  clientPhone: string | null
  staffName: string
  staffRole: string
  startsOn: string | null
  live: keyof typeof LIVE_LABEL | null
  duties: string | null
  rate: number | null
  ratePeriod: 'day' | 'month' | null
  amountDue: number | null
  defaults: TemplateDefaults
}): Record<string, string> {
  return {
    contract_date: formatDate(new Date(), { day: 'numeric', month: 'long', year: 'numeric' }),
    agency_name: input.agencyName,
    client_name: input.clientName ?? 'the Client',
    client_location: input.clientLocation ?? 'Kenya',
    client_phone: input.clientPhone ?? '',
    staff_name: input.staffName,
    staff_role: input.staffRole,
    start_date: input.startsOn ? formatDate(input.startsOn, { day: 'numeric', month: 'long', year: 'numeric' }) : 'a date agreed with the Agency',
    live_arrangement: input.live ? LIVE_LABEL[input.live] : 'As agreed',
    duties: input.duties?.trim() || `General ${input.staffRole.toLowerCase()} duties as agreed with the Client.`,
    rate: input.rate != null ? formatKes(input.rate)! : 'the agreed rate',
    rate_period: input.ratePeriod ?? 'month',
    amount_due: input.amountDue != null ? formatKes(input.amountDue)! : 'KES 0',
    trial_period_days: String(input.defaults.trial_period_days),
    notice_period_days: String(input.defaults.notice_period_days),
    replacement_window_days: String(input.defaults.replacement_window_days),
    max_replacements: String(input.defaults.max_replacements),
  }
}

export function readTerms(terms: Json): ContractTerms | null {
  if (!terms || typeof terms !== 'object' || Array.isArray(terms) || typeof terms.body !== 'string') return null
  return terms as unknown as ContractTerms
}

