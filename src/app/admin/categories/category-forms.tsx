'use client'

import { useActionState, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, Trash2 } from 'lucide-react'
import { IconPicker } from '@/components/admin/icon-picker'
import { CategoryIcon } from '@/components/category-icon'
import { StatusPill } from '@/components/portal/portal-shell'
import { Checkbox, Field, FormAlert, SubmitButton, TextArea, type FormState } from '@/components/ui/form'
import { createCategory, deleteCategory, moveCategory, updateCategory } from './actions'

type Category = {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  is_active: boolean
  staffCount: number
}

function CategoryFields({ category }: { category?: Category }) {
  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
        <Field label="Name" name="name" required maxLength={60} defaultValue={category?.name} placeholder="e.g. Pool Cleaner" />
        <TextArea label="Short description" name="description" rows={2} maxLength={300} defaultValue={category?.description ?? ''} placeholder="Shown on the services page" />
      </div>
      <IconPicker defaultValue={category?.icon} />
      <Checkbox label="Show on the website" name="is_active" defaultChecked={category?.is_active ?? true} hint="Hidden categories keep their staff but disappear from the public site." />
    </div>
  )
}

export function NewCategoryForm() {
  const [state, action] = useActionState<FormState, FormData>(createCategory, {})
  return (
    <form action={action} className="grid gap-4">
      <CategoryFields />
      <FormAlert error={state.error} message={state.message} />
      <div>
        <SubmitButton>Add category</SubmitButton>
      </div>
    </form>
  )
}

export function CategoryRow({ category, first, last }: { category: Category; first: boolean; last: boolean }) {
  const [open, setOpen] = useState(false)
  const [state, action] = useActionState<FormState, FormData>(updateCategory, {})
  const [delState, delAction] = useActionState<FormState, FormData>(deleteCategory, {})

  return (
    <li className="rounded-2xl border border-brand-100 bg-white">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500">
          <CategoryIcon name={category.icon} className="size-5" />
        </span>
        <button type="button" onClick={() => setOpen((o) => !o)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <span className="block truncate font-semibold text-navy-800">{category.name}</span>
          <span className="block text-xs text-navy-400">
            /services/{category.slug} · {category.staffCount} staff
          </span>
        </button>
        {!category.is_active && <StatusPill status="hidden" />}
        <form action={moveCategory} className="flex">
          <input type="hidden" name="id" value={category.id} />
          <button name="dir" value="up" disabled={first} className="grid size-9 place-items-center rounded-full text-navy-400 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-30" aria-label={`Move ${category.name} up`}>
            <ArrowUp className="size-4" />
          </button>
          <button name="dir" value="down" disabled={last} className="grid size-9 place-items-center rounded-full text-navy-400 hover:bg-brand-50 hover:text-brand-600 disabled:opacity-30" aria-label={`Move ${category.name} down`}>
            <ArrowDown className="size-4" />
          </button>
        </form>
        <button type="button" onClick={() => setOpen((o) => !o)} className="grid size-9 place-items-center rounded-full text-navy-400 hover:bg-brand-50" aria-label={open ? 'Close editor' : `Edit ${category.name}`}>
          <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="border-t border-brand-50 px-4 py-5">
          <form action={action} className="grid gap-4">
            <input type="hidden" name="id" value={category.id} />
            <CategoryFields category={category} />
            <FormAlert error={state.error} message={state.message} />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SubmitButton size="sm">Save changes</SubmitButton>
            </div>
          </form>
          <form
            action={delAction}
            onSubmit={(e) => {
              if (!confirm(`Delete “${category.name}”? This can't be undone.`)) e.preventDefault()
            }}
            className="mt-4 grid gap-3 border-t border-dashed border-brand-100 pt-4"
          >
            <input type="hidden" name="id" value={category.id} />
            <FormAlert error={delState.error} />
            <div>
              <SubmitButton variant="ghost" size="sm" className="text-red-600 hover:bg-red-50 hover:text-red-700">
                <Trash2 className="size-4" /> Delete category
              </SubmitButton>
            </div>
          </form>
        </div>
      )}
    </li>
  )
}
