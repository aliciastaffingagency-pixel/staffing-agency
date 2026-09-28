import { supabase } from './supabase'

// The website's JSON API. Server-side work (contract signing with IP capture,
// M-Pesa prompts, notifications) runs there so the app and website behave identically.
const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '')

export type Op = 'bookings' | 'sign' | 'pay' | 'threads' | 'messages' | 'ratings' | 'push-token'

async function post<T>(path: string, body: unknown, withAuth = true): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (withAuth) {
    const { data } = await supabase.auth.getSession()
    if (data.session) headers.Authorization = `Bearer ${data.session.access_token}`
  }
  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  } catch {
    throw new Error('No connection. Check your internet and try again.')
  }
  const json = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(json.error ?? `Something went wrong (${res.status})`)
  return json
}

export const api = {
  op: <T = Record<string, unknown>>(op: Op, body: Record<string, unknown>) => post<T>(`/api/mobile/${op}`, body),
  match: <T>(query: string) => post<T>('/api/match', { query }),
}

export const websiteUrl = (path: string) => `${API_URL}${path}`
