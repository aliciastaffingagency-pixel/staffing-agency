'use client'

import { useState } from 'react'
import { cn, formatKes } from '@/lib/utils'

export type BarDatum = { label: string; value: number; hint?: string }
export type Unit = 'count' | 'kes'

// Props must stay serialisable (server → client), so formatting is chosen by name.
const fmt = (unit: Unit) => (v: number) => (unit === 'kes' ? formatKes(v)! : v.toLocaleString('en-KE'))

// Ranked horizontal bars (single series, one hue). Hover or focus a row for exact figures.
export function BarList({ data, unit = 'count', emptyText = 'No data yet.' }: { data: BarDatum[]; unit?: Unit; emptyText?: string }) {
  const format = fmt(unit)
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!data.length) return <p className="py-6 text-center text-sm text-navy-400">{emptyText}</p>

  return (
    <ul className="grid gap-1" onMouseLeave={() => setActive(null)}>
      {data.map((d, i) => (
        <li
          key={d.label}
          tabIndex={0}
          onMouseEnter={() => setActive(i)}
          onFocus={() => setActive(i)}
          onBlur={() => setActive(null)}
          className={cn('relative grid grid-cols-[minmax(6rem,11rem)_1fr_auto] items-center gap-3 rounded-lg px-2 py-1.5 outline-none', active === i && 'bg-blush')}
        >
          <span className="truncate text-sm text-navy-700" title={d.label}>{d.label}</span>
          <span className="h-2.5 rounded-full bg-navy-50">
            <span className="block h-full rounded-r-[4px] rounded-l-full bg-brand-500 transition-[width] duration-500" style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }} />
          </span>
          <span className="min-w-12 text-right text-sm font-semibold tabular-nums text-navy-800">{format(d.value)}</span>
          {active === i && (
            <span role="tooltip" className="pointer-events-none absolute -top-9 left-1/3 z-10 whitespace-nowrap rounded-lg bg-navy-800 px-2.5 py-1.5 text-xs text-white shadow-soft">
              <strong>{d.label}</strong>: {format(d.value)}
              {total > 0 && ` · ${Math.round((d.value / total) * 100)}% of total`}
              {d.hint && ` · ${d.hint}`}
            </span>
          )}
        </li>
      ))}
    </ul>
  )
}

// Vertical columns over time (single series). Baseline-anchored, rounded data ends, 2px gaps.
export function ColumnChart({ data, unit = 'count' }: { data: BarDatum[]; unit?: Unit }) {
  const format = fmt(unit)
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <div>
      <div className="relative flex h-44 items-end gap-0.5 border-b border-navy-100" onMouseLeave={() => setActive(null)}>
        {data.map((d, i) => (
          <button
            key={d.label}
            type="button"
            onMouseEnter={() => setActive(i)}
            onFocus={() => setActive(i)}
            onBlur={() => setActive(null)}
            aria-label={`${d.label}: ${format(d.value)}`}
            className="group relative flex h-full flex-1 items-end justify-center outline-none"
          >
            <span
              className={cn('block w-full max-w-12 rounded-t-[4px] transition-all duration-500', active === i ? 'bg-brand-600' : 'bg-brand-500')}
              style={{ height: `${d.value > 0 ? Math.max(2, (d.value / max) * 100) : 0}%` }}
            />
            {active === i && (
              <span role="tooltip" className="pointer-events-none absolute -top-8 z-10 whitespace-nowrap rounded-lg bg-navy-800 px-2.5 py-1.5 text-xs text-white shadow-soft">
                {d.label}: <strong>{format(d.value)}</strong>
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-0.5">
        {data.map((d) => (
          <span key={d.label} className="flex-1 text-center text-[0.7rem] text-navy-400">{d.label}</span>
        ))}
      </div>
    </div>
  )
}
