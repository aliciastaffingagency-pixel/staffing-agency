export const formatKes = (n: number | null | undefined) =>
  n == null ? '' : `Ksh ${Math.round(Number(n)).toLocaleString('en-KE')}`

export const formatDate = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

export const formatDateTime = (v: string | null | undefined) =>
  v ? new Date(v).toLocaleString('en-KE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''

export const LIVE_LABEL = { live_in: 'Live-in', live_out: 'Live-out', either: 'Live-in or out' } as const

export const titleCase = (s: string) => s.replaceAll('_', ' ').replace(/^\w/, (c) => c.toUpperCase())
