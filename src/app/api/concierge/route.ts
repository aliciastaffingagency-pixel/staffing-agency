import { z } from 'zod'
import { aiEnabled, conciergeReply } from '@/lib/ai'
import { getAgency } from '@/lib/agency'
import { conciergeFacts, findPhone, rulesReply } from '@/lib/concierge'
import { notify } from '@/lib/notify'
import { rateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Json } from '@/lib/supabase/database.types'
import { normalizeKePhone } from '@/lib/utils'

const bodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(1000) }))
    .min(1)
    .max(16)
    .refine((m) => m[0].role === 'user' && m[m.length - 1].role === 'user', 'Conversation must start and end with the visitor'),
})

// Website concierge chat. Public, so rate-limited per IP and capped in size.
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'Invalid message' }, { status: 400 })
  if (!(await rateLimit('concierge', 30, 600))) {
    return Response.json({ reply: 'You’ve sent a lot of messages. Please WhatsApp us and we’ll continue there.' }, { status: 429 })
  }

  const history = parsed.data.messages
  const [agency, facts] = await Promise.all([getAgency(), conciergeFacts()])

  const saveLead = async (lead: { name?: string; phone: string; need: string; area?: string; start_date?: string; budget?: string }) => {
    const phone = normalizeKePhone(lead.phone) ?? lead.phone.slice(0, 20)
    await createAdminClient()
      .from('leads')
      .insert({ agency_id: agency.id, source: 'concierge', ...lead, phone, transcript: history as unknown as Json })
    await notify({
      agencyId: agency.id,
      role: 'super_admin',
      type: 'new_request',
      subject: 'New website lead',
      message: `Website chat lead: ${lead.name ?? 'Visitor'} (${phone}) needs ${lead.need.slice(0, 100)}. Please call back.`,
      link: '/admin/leads',
      sms: true,
    })
  }

  if (aiEnabled()) {
    try {
      const { reply, leadSaved } = await conciergeReply(history, facts.text, saveLead)
      return Response.json({ reply, leadSaved, engine: 'ai' })
    } catch (e) {
      console.error('concierge AI failed, using rules', e)
    }
  }

  // Rules mode: a phone number in the latest message becomes a callback lead.
  const last = history[history.length - 1].content
  const phone = findPhone(last)
  if (phone) {
    const need = history.filter((m) => m.role === 'user').map((m) => m.content).join(' | ').slice(0, 1000)
    await saveLead({ phone, need, name: last.replace(phone, '').replace(/[^A-Za-z '-]/g, ' ').trim().slice(0, 60) || undefined })
    return Response.json({ reply: `Asante! We've passed your details to the team and they'll call you on ${phone} shortly.`, leadSaved: true, engine: 'rules' })
  }
  return Response.json({ reply: rulesReply(last, facts), leadSaved: false, engine: 'rules' })
}
