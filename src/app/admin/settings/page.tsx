import type { Metadata } from 'next'
import { AlertTriangle } from 'lucide-react'
import { PageHeader, Panel } from '@/components/portal/portal-shell'
import { getAgency } from '@/lib/agency'
import { requireRole } from '@/lib/auth'
import { PLACEHOLDERS, type TemplateDefaults } from '@/lib/contracts-shared'
import { createClient } from '@/lib/supabase/server'
import { AgencyForm, TemplateForm } from './settings-forms'

export const metadata: Metadata = { title: 'Settings' }

export default async function SettingsPage() {
  const session = await requireRole('super_admin')
  const supabase = await createClient()
  const [agency, { data: template }] = await Promise.all([
    getAgency(),
    supabase.from('contract_templates').select('*').eq('agency_id', session.agency_id).eq('is_active', true).order('version', { ascending: false }).limit(1).maybeSingle(),
  ])
  const d = (template?.defaults ?? {}) as unknown as TemplateDefaults

  return (
    <div className="grid gap-8">
      <PageHeader title="Settings" description="Your agency's public details and the contract every client signs." />

      <Panel title="Agency details">
        <AgencyForm
          agency={{
            name: agency.name,
            tagline: agency.tagline,
            phone: agency.phone,
            whatsapp: agency.whatsapp,
            email: agency.email,
            service_area_label: agency.settings.service_area_label ?? 'Serving all areas',
            address: agency.settings.address ?? '',
            odpc_registration: agency.settings.odpc_registration ?? '',
            stats: (agency.settings.stats ?? []).map((s) => [s.label, s.value, s.suffix].filter((x) => x != null && x !== '').join(' | ')).join('\n'),
          }}
        />
      </Panel>

      <Panel title={`Contract template${template ? ` (version ${template.version})` : ''}`}>
        {!d.confirmed_by_owner && (
          <p className="mb-4 flex items-start gap-2 rounded-2xl bg-gold-100/70 px-4 py-3 text-sm text-navy-700">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-gold-700" />
            These are starter terms. Check the trial period, notice period and replacement policy against how you really work, then save to confirm.
          </p>
        )}
        <p className="mb-4 text-sm text-navy-500">
          Placeholders filled in automatically:{' '}
          {PLACEHOLDERS.map((p) => (
            <code key={p} className="mr-1 rounded bg-blush px-1.5 py-0.5 text-xs text-brand-700">{`{{${p}}}`}</code>
          ))}
        </p>
        {template && (
          <TemplateForm
            template={{
              name: template.name,
              body: template.body,
              trial_period_days: d.trial_period_days ?? 14,
              notice_period_days: d.notice_period_days ?? 14,
              replacement_window_days: d.replacement_window_days ?? 90,
              max_replacements: d.max_replacements ?? 2,
            }}
          />
        )}
      </Panel>
    </div>
  )
}
