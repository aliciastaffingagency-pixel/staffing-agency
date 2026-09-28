import 'server-only'
import { cache } from 'react'
import { formatPhone, getAgency } from '@/lib/agency'
import type { TemplateDefaults } from '@/lib/contracts-shared'
import { createAdminClient } from '@/lib/supabase/admin'

// Date shown as "Last updated" on the legal pages. Change it whenever the wording changes.
export const LEGAL_UPDATED = '29 September 2026'

// Everything the legal pages print about the agency, from live data (never hard-coded).
export const getLegalDetails = cache(async () => {
  const agency = await getAgency()
  const { data: template } = await createAdminClient()
    .from('contract_templates')
    .select('defaults')
    .eq('agency_id', agency.id)
    .eq('is_active', true)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle()
  const terms = { trial_period_days: 14, notice_period_days: 14, replacement_window_days: 90, max_replacements: 2, ...((template?.defaults ?? {}) as Partial<TemplateDefaults>) }
  return {
    name: agency.name,
    email: agency.email ?? '',
    phone: formatPhone(agency.phone),
    whatsapp: agency.whatsapp ?? '',
    address: agency.settings.address ?? 'Nairobi, Kenya',
    odpc: agency.settings.odpc_registration ?? null,
    terms,
  }
})
