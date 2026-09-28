import 'server-only'
import { after } from 'next/server'
import { siteUrl } from '@/lib/site-url'
import { createAdminClient } from '@/lib/supabase/admin'
import type { Enums } from '@/lib/supabase/database.types'

type NotificationType = Enums<'notification_type'>

const SITE = siteUrl

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

// ---------------------------------------------------------------------------
// Channels. Each one is a no-op (logged) until its API key is configured.
// ---------------------------------------------------------------------------
export async function sendEmail(to: string | null | undefined, subject: string, text: string, link?: string | null) {
  const key = process.env.RESEND_API_KEY
  if (!to) return
  if (!key) {
    if (process.env.NODE_ENV !== 'production') console.info(`[email skipped: no RESEND_API_KEY] ${to}: ${subject}`)
    return
  }
  const url = link ? `${SITE()}${link}` : null
  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1C1F4A">
    <p style="font-size:22px;color:#D61F7A;font-weight:bold;margin:0 0 16px">Alicia Staffing Agency</p>
    <p style="font-size:15px;line-height:1.6">${escapeHtml(text).replace(/\n/g, '<br>')}</p>
    ${url ? `<p><a href="${url}" style="display:inline-block;background:#D61F7A;color:#fff;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:bold">Open in your account</a></p>` : ''}
    <p style="font-size:12px;color:#7f89bf;margin-top:28px">Reliable · Trustworthy · Professional</p></div>`
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'Alicia Staffing Agency <onboarding@resend.dev>',
        to: [to],
        subject,
        text: url ? `${text}\n\n${url}` : text,
        html,
      }),
    })
    if (!res.ok) console.error('resend failed', res.status, await res.text())
  } catch (e) {
    console.error('resend error', e)
  }
}

export async function sendSms(to: string | null | undefined, message: string) {
  const username = process.env.AFRICASTALKING_USERNAME
  const apiKey = process.env.AFRICASTALKING_API_KEY
  if (!to) return
  if (!username || !apiKey) {
    if (process.env.NODE_ENV !== 'production') console.info(`[sms skipped: no Africa's Talking keys] ${to}: ${message}`)
    return
  }
  const sandbox = username === 'sandbox'
  const body = new URLSearchParams({ username, to, message })
  if (process.env.AFRICASTALKING_SENDER_ID) body.set('from', process.env.AFRICASTALKING_SENDER_ID)
  try {
    const res = await fetch(`https://api.${sandbox ? 'sandbox.' : ''}africastalking.com/version1/messaging`, {
      method: 'POST',
      headers: { apiKey, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) console.error('africastalking failed', res.status, await res.text())
  } catch (e) {
    console.error('africastalking error', e)
  }
}

// Expo push to the mobile app (no key needed; invalid tokens are pruned).
export async function sendPush(userIds: string[], title: string, body: string, link?: string | null) {
  if (!userIds.length) return
  const admin = createAdminClient()
  const { data: tokens } = await admin.from('push_tokens').select('token').in('user_id', userIds)
  if (!tokens?.length) return
  try {
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(tokens.map((t) => ({ to: t.token, sound: 'default', title, body, data: link ? { link } : {} }))),
    })
    const json = (await res.json().catch(() => null)) as { data?: { status: string; details?: { error?: string } }[] } | null
    const dead = (json?.data ?? []).flatMap((r, i) => (r.details?.error === 'DeviceNotRegistered' ? [tokens[i].token] : []))
    if (dead.length) await admin.from('push_tokens').delete().in('token', dead)
  } catch (e) {
    console.error('expo push error', e)
  }
}

// ---------------------------------------------------------------------------
// In-app notification + optional email/SMS.
// ---------------------------------------------------------------------------
type NotifyInput = {
  agencyId: string
  type: NotificationType
  message: string
  link?: string | null
  subject?: string
} & ({ userId: string; role?: never } | { role: 'super_admin'; userId?: never })

export async function notify(input: NotifyInput & { sms?: boolean }) {
  const admin = createAdminClient()
  const { error } = await admin.from('notifications').insert({
    agency_id: input.agencyId,
    type: input.type,
    message: input.message,
    link: input.link ?? null,
    target_user_id: input.userId ?? null,
    target_role: input.userId ? null : input.role,
  })
  if (error) console.error('notification insert failed', error.message)

  // Email / SMS go out after the response so users aren't kept waiting on providers.
  after(() => deliver(input))
}

async function deliver(input: NotifyInput & { sms?: boolean }) {
  const admin = createAdminClient()
  const subject = input.subject ?? input.message.slice(0, 80)
  if (input.userId) {
    const { data: profile } = await admin.from('profiles').select('email, phone').eq('id', input.userId).maybeSingle()
    await Promise.all([
      sendPush([input.userId], subject, input.message, input.link),
      sendEmail(profile?.email, subject, input.message, input.link),
      input.sms ? sendSms(profile?.phone, `${input.message}${input.link ? ` ${SITE()}${input.link}` : ''}`) : null,
    ])
  } else {
    // Agency owner: email the agency inbox (plus every admin account).
    const [{ data: agency }, { data: admins }] = await Promise.all([
      admin.from('agencies').select('email, phone').eq('id', input.agencyId).single(),
      admin.from('profiles').select('id, email').eq('agency_id', input.agencyId).eq('role', 'super_admin'),
    ])
    const emails = new Set([agency?.email, ...(admins ?? []).map((a) => a.email)].filter(Boolean) as string[])
    await Promise.all([
      sendPush((admins ?? []).map((a) => a.id), subject, input.message, input.link),
      ...[...emails].map((e) => sendEmail(e, subject, input.message, input.link)),
      input.sms ? sendSms(agency?.phone, input.message) : null,
    ])
  }
}

// Convenience for "tell the client behind this client row".
export async function notifyClient(clientId: string, n: Omit<NotifyInput, 'userId' | 'role'> & { sms?: boolean }) {
  const { data } = await createAdminClient().from('clients').select('user_id').eq('id', clientId).single()
  // A client who deleted their account has no login left to notify.
  if (data?.user_id) await notify({ ...n, userId: data.user_id })
}
