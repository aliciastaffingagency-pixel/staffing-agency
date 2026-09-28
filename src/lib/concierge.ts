import 'server-only'
import { formatPhone, getAgency, getCategories } from '@/lib/agency'
import type { TemplateDefaults } from '@/lib/contracts-shared'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatKes } from '@/lib/utils'

export type ConciergeFacts = {
  text: string
  phone: string
  whatsapp: string
  serviceArea: string
  terms: TemplateDefaults
  priceLines: string[]
}

// Everything the concierge may say comes from here: real agency data only.
export async function conciergeFacts(): Promise<ConciergeFacts> {
  const [agency, categories] = await Promise.all([getAgency(), getCategories()])
  const admin = createAdminClient()
  const [{ data: staff }, { data: template }, { count: openJobs }] = await Promise.all([
    admin.from('staff_catalog').select('category_id, month_rate, day_rate, availability').eq('agency_id', agency.id),
    admin.from('contract_templates').select('defaults').eq('agency_id', agency.id).eq('is_active', true).order('version', { ascending: false }).limit(1).maybeSingle(),
    admin.from('vacancies').select('id', { count: 'exact', head: true }).eq('agency_id', agency.id).eq('status', 'open'),
  ])
  const terms = { trial_period_days: 14, notice_period_days: 14, replacement_window_days: 90, max_replacements: 2, ...((template?.defaults ?? {}) as Partial<TemplateDefaults>) }

  const priceLines = categories.map((c) => {
    const inCat = (staff ?? []).filter((s) => s.category_id === c.id)
    const monthly = inCat.map((s) => s.month_rate).filter((v): v is number => v != null)
    const available = inCat.filter((s) => s.availability === 'available').length
    const range = monthly.length ? `${formatKes(Math.min(...monthly))}–${formatKes(Math.max(...monthly))} per month` : 'rates on request'
    return `- ${c.name}: ${range}; ${available} available now${c.description ? `. ${c.description}` : ''}`
  })

  const phone = formatPhone(agency.phone)
  const text = `Agency: ${agency.name}. ${agency.tagline ?? ''}
Contact: phone/WhatsApp ${phone}, email ${agency.email}. Service area: ${agency.settings.service_area_label ?? 'Nairobi and surrounding areas'}.
Services and typical staff pay (paid by the client to the staff member; the agency charges a separate placement fee stated in the contract):
${priceLines.join('\n')}
How it works: browse vetted staff online (/staff) or describe your need (/match); send a request (/book); the agency confirms the match (usually the same day); you sign a digital contract online; pay the agency fee by M-Pesa or card; the placement starts.
Vetting: profiles show badges only for checks passed. Verified = national ID checked in person; Background-checked = references called and background check passed; Trained = completed agency training.
Contract terms: ${terms.trial_period_days}-day trial period; ${terms.notice_period_days} days' notice after the trial; up to ${terms.max_replacements} free replacement(s) within ${terms.replacement_window_days} days of the start date.
After placement: clients rate staff, message the agency, and request replacements from their online account.
Job seekers: ${openJobs ? `${openJobs} open vacancies at /jobs` : 'see /jobs'}; anyone can also send a general application at /jobs/apply and choose to join the agency or propose their own terms.`

  return { text, phone, whatsapp: agency.whatsapp ?? '', serviceArea: agency.settings.service_area_label ?? 'Nairobi and surrounding areas', terms, priceLines }
}

// Used when no AI key is configured: keyword FAQ over the same facts.
export function rulesReply(message: string, f: ConciergeFacts): string {
  const m = message.toLowerCase()
  const has = (...w: string[]) => w.some((x) => m.includes(x))
  if (has('price', 'cost', 'how much', 'rate', 'salary', 'pay them', 'charges', 'fee'))
    return `Typical monthly pay by role:\n${f.priceLines.map((l) => l.split(';')[0].replace('- ', '• ')).join('\n')}\nThe agency fee is shown in your contract. Want someone to call you with a quote? Share your name and number.`
  if (has('replace', 'replacement', 'not happy', 'change'))
    return `If your staff member leaves or isn't a good fit within ${f.terms.replacement_window_days} days, we replace them up to ${f.terms.max_replacements} time(s) at no extra placement fee. You can request it from your account.`
  if (has('trial', 'contract', 'notice'))
    return `Every placement has a written contract you sign online: a ${f.terms.trial_period_days}-day trial, then ${f.terms.notice_period_days} days' notice either way.`
  if (has('mpesa', 'm-pesa', 'card', 'payment', 'pay'))
    return 'After signing your contract you pay the agency fee online by M-Pesa (you get a prompt on your phone) or by card.'
  if (has('job', 'work', 'apply', 'employ', 'vacanc', 'kazi'))
    return 'Looking for work? See open vacancies at /jobs, or send a general application at /jobs/apply. Upload your ID and CV and choose to join us or propose your own terms.'
  if (has('where', 'area', 'location', 'serve', 'mombasa', 'nakuru', 'kisumu'))
    return `${f.serviceArea}. Tell us your area and we'll match people who live nearby.`
  if (has('vet', 'trust', 'safe', 'background', 'verified', 'check'))
    return 'Every profile shows the checks that person passed: Verified (ID checked in person), Background-checked (references and background check) and Trained (our training).'
  if (has('hello', 'hi', 'habari', 'jambo', 'hey'))
    return 'Karibu! I can answer questions about our staff, prices, contracts and payments. What are you looking for?'
  return `I can help with services, prices, contracts, payments and jobs. For anything else, WhatsApp us on ${f.phone}. Or leave your name and number and we'll call you.`
}

// Finds a Kenyan phone number in free text (for lead capture without AI).
export function findPhone(text: string) {
  const m = text.replace(/[\s-]/g, '').match(/(?:\+?254|0)[17]\d{8}/)
  return m ? m[0] : null
}
