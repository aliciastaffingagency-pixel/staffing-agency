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
