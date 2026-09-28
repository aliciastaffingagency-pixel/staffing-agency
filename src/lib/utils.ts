export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

export function formatKes(amount: number | null | undefined) {
  if (amount == null) return null
  return new Intl.NumberFormat('en-KE', { style: 'currency', currency: 'KES', maximumFractionDigits: 0 }).format(amount)
}

// Only allow same-site relative redirects (prevents open redirects via ?next=).
export function safeNext(next: FormDataEntryValue | string | null | undefined, fallback = '/dashboard') {
  const value = typeof next === 'string' ? next : ''
  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : fallback
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

export function formatDate(value: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-KE', opts)
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return ''
  return new Date(value).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// "a, b ,c" → ['a','b','c'] (deduplicated, blanks dropped)
export function splitList(value: FormDataEntryValue | null | undefined) {
  return [...new Set(String(value ?? '').split(',').map((s) => s.trim()).filter(Boolean))]
}

// Normalises Kenyan numbers to +2547XXXXXXXX / +2541XXXXXXXX. Returns null if invalid.
export function normalizeKePhone(value: string | null | undefined) {
  const v = String(value ?? '').replace(/[\s()-]/g, '')
  const m = v.match(/^(?:\+?254|0)?([17]\d{8})$/)
  return m ? `+254${m[1]}` : null
}

export const LIVE_LABEL = { live_in: 'Live-in', live_out: 'Live-out', either: 'Live-in or out' } as const
export const AVAILABILITY_LABEL = { available: 'Available', placed: 'Currently placed', unavailable: 'Unavailable' } as const
