import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Field({
  label,
  hint,
  className,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="text-sm font-semibold text-navy-700">{label}</span>
      <input
        {...input}
        className="mt-1.5 block h-12 w-full rounded-2xl border border-navy-100 bg-white px-4 text-navy-800 outline-none transition placeholder:text-navy-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100"
      />
      {hint && <span className="mt-1 block text-xs text-navy-400">{hint}</span>}
    </label>
  )
}

export function FormAlert({ error, message }: { error?: string; message?: string }) {
  if (!error && !message) return null
  const isError = Boolean(error)
  return (
    <p
      role={isError ? 'alert' : 'status'}
      className={cn(
        'flex items-start gap-2 rounded-2xl px-4 py-3 text-sm',
        isError ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800',
      )}
    >
      {isError ? <AlertCircle className="mt-0.5 size-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 size-4 shrink-0" />}
      {error ?? message}
    </p>
  )
}
