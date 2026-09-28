'use client'

import { useState } from 'react'
import { CATEGORY_ICONS } from '@/components/category-icon'
import { cn } from '@/lib/utils'

export function IconPicker({ name = 'icon', defaultValue }: { name?: string; defaultValue?: string | null }) {
  const [value, setValue] = useState(defaultValue ?? 'Users')
  return (
    <fieldset>
      <legend className="text-sm font-semibold text-navy-700">Icon</legend>
      <input type="hidden" name={name} value={value} />
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
          <button
            key={key}
            type="button"
            onClick={() => setValue(key)}
            aria-pressed={value === key}
            title={key}
            className={cn(
              'grid size-10 place-items-center rounded-xl border transition',
              value === key ? 'border-brand-500 bg-brand-500 text-white' : 'border-navy-100 bg-white text-navy-500 hover:border-brand-300 hover:text-brand-500',
            )}
          >
            <Icon className="size-5" aria-hidden="true" />
            <span className="sr-only">{key}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
