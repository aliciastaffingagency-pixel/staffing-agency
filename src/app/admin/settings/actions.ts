'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { FormState } from '@/components/ui/form'
import { asJson, type AgencySettings } from '@/lib/agency'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { normalizeKePhone } from '@/lib/utils'

export async function saveAgency(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('super_admin')
  const s = (k: string) => String(formData.get(k) ?? '').trim()
  const phone = normalizeKePhone(s('phone'))
  const whatsapp = normalizeKePhone(s('whatsapp'))
  const parsed = z
    .object({
      name: z.string().min(2).max(120),
      tagline: z.string().max(160),
      email: z.email('Enter a valid email'),
      service_area_label: z.string().max(80),
    })
    .safeParse({ name: s('name'), tagline: s('tagline'), email: s('email'), service_area_label: s('service_area_label') })
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  if (!phone || !whatsapp) return { error: 'Enter valid Kenyan phone numbers for phone and WhatsApp' }

  // Marketing counters: only real figures, one per line as "label | value | suffix".
  const stats = s('stats')
    .split('\n')
    .map((l) => l.split('|').map((p) => p.trim()))
    .filter((p) => p[0] && p[1] && Number.isFinite(Number(p[1].replace(/,/g, ''))))
    .slice(0, 4)
    .map(([label, value, suffix]) => ({ label, value: Number(value.replace(/,/g, '')), ...(suffix ? { suffix } : {}) }))

  const supabase = await createClient()
  const { data: agency } = await supabase.from('agencies').select('settings').eq('id', session.agency_id).single()
  const settings: AgencySettings = { ...((agency?.settings ?? {}) as AgencySettings), service_area_label: parsed.data.service_area_label, stats }

  const { error } = await supabase
    .from('agencies')
    .update({
      name: parsed.data.name,
      tagline: parsed.data.tagline || null,
      email: parsed.data.email,
      phone,
      whatsapp: whatsapp.replace(/^\+/, ''),
      settings: asJson(settings),
    })
    .eq('id', session.agency_id)
  if (error) return { error: error.message }
  revalidatePath('/', 'layout')
  return { message: 'Agency details saved. The website is updated.' }
}

const int = (label: string, max: number) => z.coerce.number({ message: `Enter ${label}` }).int().min(0).max(max)

// Each save creates a new template version; existing contracts keep the version they were signed on.
export async function saveTemplate(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('super_admin')
  const parsed = z
    .object({
      name: z.string().trim().min(3).max(120),
      body: z.string().trim().min(100, 'The contract text looks too short').max(30000),
      trial_period_days: int('the trial period', 365),
      notice_period_days: int('the notice period', 365),
      replacement_window_days: int('the replacement window', 730),
      max_replacements: int('the number of replacements', 20),
    })
    .safeParse(Object.fromEntries(['name', 'body', 'trial_period_days', 'notice_period_days', 'replacement_window_days', 'max_replacements'].map((k) => [k, formData.get(k)])))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const { name, body, ...defaults } = parsed.data

  const supabase = await createClient()
  const { data: latest } = await supabase.from('contract_templates').select('version').eq('agency_id', session.agency_id).order('version', { ascending: false }).limit(1).maybeSingle()
  const version = (latest?.version ?? 0) + 1
  const { error } = await supabase.from('contract_templates').insert({
    agency_id: session.agency_id,
    version,
    name,
    body,
    defaults: { ...defaults, confirmed_by_owner: true },
    is_active: true,
  })
  if (error) return { error: error.message }
  await supabase.from('contract_templates').update({ is_active: false }).eq('agency_id', session.agency_id).neq('version', version)
  revalidatePath('/admin/settings')
  return { message: `Saved as version ${version}. New contracts use these terms.` }
}
