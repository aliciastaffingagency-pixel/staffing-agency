import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { Logo } from '@/components/brand/logo'

export type PortalLink = { href: string; label: string }

export function PortalShell({
  title,
  userName,
  roleLabel,
  links,
  children,
}: {
  title: string
  userName: string
  roleLabel: string
  links: PortalLink[]
  children: React.ReactNode
}) {
  return (
    <div className="min-h-dvh bg-blush/60">
      <header className="sticky top-0 z-30 border-b border-brand-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-6">
            <Logo className="scale-90" />
            <nav className="hidden gap-1 md:flex" aria-label={title}>
              {links.map((l) => (
                <Link key={l.href} href={l.href} className="rounded-full px-3.5 py-2 text-sm font-medium text-navy-600 hover:bg-brand-50 hover:text-brand-600">
                  {l.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-right text-sm leading-tight sm:block">
              <span className="block font-semibold text-navy-800">{userName}</span>
              <span className="text-xs text-brand-500">{roleLabel}</span>
            </span>
            <form action="/auth/signout" method="post">
              <button className="grid size-10 place-items-center rounded-full text-navy-500 hover:bg-brand-50 hover:text-brand-600" aria-label="Log out" title="Log out">
                <LogOut className="size-5" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">{children}</main>
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
