import 'server-only'
import { cache } from 'react'
import { createPublicClient } from '@/lib/supabase/public'
import type { Json, Tables } from '@/lib/supabase/database.types'

export const AGENCY_SLUG = process.env.NEXT_PUBLIC_AGENCY_SLUG ?? 'alicia'

export type AgencyStat = { label: string; value: number; suffix?: string }

export type AgencySettings = {
  service_area_label?: string
  map_center?: [number, number]
  stats?: AgencyStat[]
}

export type Agency = Omit<Tables<'agencies'>, 'settings'> & { settings: AgencySettings }

export const getAgency = cache(async (): Promise<Agency> => {
  const supabase = createPublicClient()
  const { data, error } = await supabase.from('agencies').select('*').eq('slug', AGENCY_SLUG).single()
  if (error || !data) throw new Error(`Agency "${AGENCY_SLUG}" not found: ${error?.message}`)
  return { ...data, settings: (data.settings ?? {}) as AgencySettings }
})

export const getCategories = cache(async () => {
  const agency = await getAgency()
  const supabase = createPublicClient()
  const { data, error } = await supabase
    .from('staff_categories')
    .select('id, name, slug, description, icon, image_url, sort_order')
    .eq('agency_id', agency.id)
    .eq('is_active', true)
    .order('sort_order')
  if (error) throw error
  return data
})

export function whatsappLink(agency: Pick<Agency, 'whatsapp' | 'name'>, message?: string) {
  const text = message ?? `Hello ${agency.name}, I'd like to enquire about your staff.`
  return `https://wa.me/${agency.whatsapp}?text=${encodeURIComponent(text)}`
}

export function formatPhone(phone: string | null) {
  if (!phone) return ''
  const m = phone.replace(/\s+/g, '').match(/^\+?(254)(\d{3})(\d{3})(\d{3})$/)
  return m ? `+${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone
}

export function asJson<T>(value: T) {
  return value as unknown as Json
}
