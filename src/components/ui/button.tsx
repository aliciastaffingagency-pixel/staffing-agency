import Link from 'next/link'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'navy' | 'outline' | 'ghost' | 'whatsapp' | 'gold'
type Size = 'sm' | 'md' | 'lg'

const variants: Record<Variant, string> = {
  primary:
    'bg-brand-500 text-white shadow-[0_10px_24px_-10px_rgb(214_31_122/0.7)] hover:bg-brand-600 focus-visible:outline-brand-500',
  navy: 'bg-navy-800 text-white hover:bg-navy-700 focus-visible:outline-navy-800',
  outline: 'border-2 border-navy-800/15 bg-white/70 text-navy-800 hover:border-brand-400 hover:text-brand-600',
  ghost: 'text-navy-800 hover:bg-brand-50 hover:text-brand-600',
  whatsapp: 'bg-[#25D366] text-white hover:bg-[#1fb957] shadow-[0_10px_24px_-10px_rgb(37_211_102/0.7)]',
  gold: 'bg-gold-500 text-navy-900 hover:bg-gold-400',
}

const sizes: Record<Size, string> = {
  sm: 'h-9 px-4 text-sm',
  md: 'h-11 px-5 text-sm',
  lg: 'h-13 px-7 text-base',
}

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(
    'inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-all duration-200',
    'focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60',
    variants[variant],
    sizes[size],
    className,
  )
}

export function Button({
  variant,
  size,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />
}
