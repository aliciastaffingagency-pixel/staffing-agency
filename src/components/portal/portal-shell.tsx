import { LogOut } from 'lucide-react'
import { Logo } from '@/components/brand/logo'
import { PortalNav, type PortalLink } from './portal-nav'

export type { PortalLink }

export function PortalShell({
  title,
  userName,
  roleLabel,
  links,
  headerExtra,
  layout = 'top',
  children,
}: {
  title: string
  userName: string
  roleLabel: string
  links: PortalLink[]
  headerExtra?: React.ReactNode
  /** 'sidebar' suits portals with many sections (admin); 'top' keeps a single row of links. */
  layout?: 'top' | 'sidebar'
  children: React.ReactNode
}) {
  const sidebar = layout === 'sidebar'
  return (
    <div className="min-h-dvh bg-blush/60">
      <header className="sticky top-0 z-30 border-b border-brand-100 bg-white/90 backdrop-blur">
        <div className={`mx-auto flex min-h-16 items-center justify-between gap-4 px-4 sm:px-6 ${sidebar ? 'max-w-[90rem]' : 'max-w-7xl'}`}>
          <div className="flex items-center gap-6">
            <Logo className="scale-90" />
            {!sidebar && <PortalNav links={links} label={title} variant="desktop" />}
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {headerExtra}
            <span className="hidden max-w-48 text-right text-sm leading-tight sm:block">
              <span className="block truncate font-semibold text-navy-800">{userName}</span>
              <span className="text-xs text-brand-500">{roleLabel}</span>
            </span>
            <form action="/auth/signout" method="post">
              <button className="grid size-10 place-items-center rounded-full text-navy-500 hover:bg-brand-50 hover:text-brand-600" aria-label="Log out" title="Log out">
                <LogOut className="size-5" />
              </button>
            </form>
          </div>
        </div>
        <PortalNav links={links} label={title} variant="mobile" />
      </header>
      {sidebar ? (
        <div className="mx-auto grid max-w-[90rem] gap-8 px-4 sm:px-6 lg:grid-cols-[13.5rem_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-24 py-10">
              <PortalNav links={links} label={title} variant="sidebar" />
            </div>
          </aside>
          <main className="min-w-0 py-10">{children}</main>
        </div>
      ) : (
        <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">{children}</main>
      )}
    </div>
  )
}

export function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="rounded-3xl border border-brand-100 bg-white p-6">
      <p className="text-sm font-medium text-navy-500">{label}</p>
      <p className="mt-2 text-4xl font-extrabold text-navy-800">{value}</p>
      {hint && <p className="mt-1 text-xs text-navy-400">{hint}</p>}
    </div>
  )
}

export function Panel({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl border border-brand-100 bg-white p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold text-navy-800">{title}</h2>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-brand-200 px-5 py-8 text-center text-sm text-navy-500">{children}</p>
}

export function PageHeader({ title, description, action }: { title: string; description?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-navy-800">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-navy-500">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLE[status] ?? 'bg-navy-50 text-navy-600'} ${className ?? ''}`}>
      {status.replaceAll('_', ' ')}
    </span>
  )
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-gold-100 text-gold-700',
  processing: 'bg-gold-100 text-gold-700',
  in_review: 'bg-gold-100 text-gold-700',
  draft: 'bg-navy-50 text-navy-500',
  matched: 'bg-navy-50 text-navy-600',
  sent: 'bg-brand-50 text-brand-600',
  client_signed: 'bg-brand-50 text-brand-600',
  contracted: 'bg-brand-50 text-brand-600',
  fully_signed: 'bg-brand-100 text-brand-700',
  active: 'bg-emerald-50 text-emerald-700',
  paid: 'bg-emerald-50 text-emerald-700',
  verified: 'bg-emerald-50 text-emerald-700',
  confirmed: 'bg-emerald-50 text-emerald-700',
  published: 'bg-emerald-50 text-emerald-700',
  open: 'bg-gold-100 text-gold-700',
  resolved: 'bg-navy-50 text-navy-500',
  completed: 'bg-navy-50 text-navy-500',
  ended: 'bg-navy-50 text-navy-500',
  cancelled: 'bg-red-50 text-red-600',
  failed: 'bg-red-50 text-red-600',
  rejected: 'bg-red-50 text-red-600',
  refunded: 'bg-red-50 text-red-600',
  hidden: 'bg-navy-50 text-navy-400',
}
