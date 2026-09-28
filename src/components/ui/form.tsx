'use client'

import { useActionState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export type FormState = { error?: string; message?: string; fields?: Record<string, string> }

const control =
  'mt-1.5 block w-full rounded-2xl border border-navy-100 bg-white px-4 text-navy-800 outline-none transition placeholder:text-navy-300 focus:border-brand-400 focus:ring-4 focus:ring-brand-100 disabled:bg-navy-50/50'

export function Field({
  label,
  hint,
  className,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="text-sm font-semibold text-navy-700">{label}</span>
      <input {...input} className={cn(control, 'h-12')} />
      {hint && <span className="mt-1 block text-xs text-navy-400">{hint}</span>}
    </label>
  )
}

export function TextArea({
  label,
  hint,
  className,
  ...input
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; hint?: string }) {
  return (
    <label className={cn('block', className)}>
      <span className="text-sm font-semibold text-navy-700">{label}</span>
      <textarea rows={4} {...input} className={cn(control, 'py-3 leading-relaxed')} />
      {hint && <span className="mt-1 block text-xs text-navy-400">{hint}</span>}
    </label>
  )
}

export function Select({
  label,
  hint,
  className,
  options,
  ...select
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string
  hint?: string
  options: ReadonlyArray<{ value: string; label: string }>
}) {
  return (
    <label className={cn('block', className)}>
      <span className="text-sm font-semibold text-navy-700">{label}</span>
      <select {...select} className={cn(control, 'h-12 appearance-none bg-[length:1.1rem] bg-[right_1rem_center] bg-no-repeat pr-10')} style={{ backgroundImage: CHEVRON }}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <span className="mt-1 block text-xs text-navy-400">{hint}</span>}
    </label>
  )
}

const CHEVRON = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234d5896' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`

export function Checkbox({
  label,
  hint,
  className,
  ...input
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className={cn('flex cursor-pointer items-start gap-3', className)}>
      <input type="checkbox" {...input} className="mt-0.5 size-5 shrink-0 accent-brand-500" />
      <span>
        <span className="text-sm font-semibold text-navy-700">{label}</span>
        {hint && <span className="block text-xs text-navy-400">{hint}</span>}
      </span>
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

// Submit button that shows a spinner while its parent <form> action runs.
export function SubmitButton({ children, pending: pendingProp, ...props }: React.ComponentProps<typeof Button> & { pending?: boolean }) {
  const status = useFormStatus()
  const pending = pendingProp ?? status.pending
  return (
    <Button type="submit" {...props} disabled={pending || props.disabled}>
      {pending && <Loader2 className="size-4 animate-spin" />}
      {children}
    </Button>
  )
}

// Like useActionState, but submits via onSubmit so React does NOT reset the
// form afterwards — long forms keep what the user typed when validation fails.
export function useFormAction<S extends object>(action: (prev: S, formData: FormData) => Promise<S>, initial: S) {
  const [state, dispatch, pending] = useActionState<S, FormData>(action as never, initial as Awaited<S>)
  const [, startTransition] = useTransition()
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter)
    startTransition(() => dispatch(fd))
  }
  return [state, onSubmit, pending] as const
}
