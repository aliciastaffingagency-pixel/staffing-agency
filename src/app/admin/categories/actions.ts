'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { FormState } from '@/components/ui/form'
import { CATEGORY_ICON_NAMES } from '@/components/category-icon'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { slugify } from '@/lib/utils'

const categorySchema = z.object({
  name: z.string().trim().min(2, 'Give the category a name').max(60),
  description: z.string().trim().max(300).optional().transform((v) => v || null),
  icon: z.enum(CATEGORY_ICON_NAMES).nullable().catch(null),
  is_active: z.boolean(),
})

function read(formData: FormData) {
  return categorySchema.safeParse({
    name: formData.get('name'),
    description: formData.get('description') ?? undefined,
    icon: formData.get('icon') || null,
    is_active: formData.get('is_active') === 'on',
  })
}

function refresh() {
  revalidatePath('/admin', 'layout')
  revalidatePath('/', 'layout')
}

export async function createCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await requireRole('super_admin')
  const parsed = read(formData)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { data: last } = await supabase
    .from('staff_categories')
    .select('sort_order')
    .eq('agency_id', session.agency_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const base = slugify(parsed.data.name) || 'category'
  const { error } = await supabase.from('staff_categories').insert({
    ...parsed.data,
    agency_id: session.agency_id,
    slug: base,
    sort_order: (last?.sort_order ?? 0) + 10,
  })
  if (error?.code === '23505') {
    // Slug taken (e.g. a hidden category with the same name): add a short suffix.
    const retry = await supabase.from('staff_categories').insert({
      ...parsed.data,
      agency_id: session.agency_id,
      slug: `${base}-${Math.random().toString(36).slice(2, 6)}`,
      sort_order: (last?.sort_order ?? 0) + 10,
    })
    if (retry.error) return { error: retry.error.message }
  } else if (error) {
    return { error: error.message }
  }

  refresh()
  return { message: `“${parsed.data.name}” added. It's live on the website now.` }
}

export async function updateCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole('super_admin')
  const id = z.uuid().safeParse(formData.get('id'))
  const parsed = read(formData)
  if (!id.success) return { error: 'Unknown category' }
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const supabase = await createClient()
  const { error } = await supabase.from('staff_categories').update(parsed.data).eq('id', id.data)
  if (error) return { error: error.message }

  refresh()
  return { message: 'Saved' }
}

export async function deleteCategory(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireRole('super_admin')
  const id = z.uuid().safeParse(formData.get('id'))
  if (!id.success) return { error: 'Unknown category' }

  const supabase = await createClient()
  const { count } = await supabase.from('staff_profiles').select('id', { count: 'exact', head: true }).eq('category_id', id.data)
  if (count) {
    return { error: `${count} staff profile${count === 1 ? ' is' : 's are'} in this category. Move them first, or hide the category instead.` }
  }
  const { error } = await supabase.from('staff_categories').delete().eq('id', id.data)
  if (error) return { error: error.message }

  refresh()
  return { message: 'Deleted' }
}

// Swaps sort_order with the neighbour above/below.
export async function moveCategory(formData: FormData) {
  const session = await requireRole('super_admin')
  const id = String(formData.get('id'))
  const dir = formData.get('dir') === 'up' ? 'up' : 'down'

  const supabase = await createClient()
  const { data: all } = await supabase
    .from('staff_categories')
    .select('id, sort_order')
    .eq('agency_id', session.agency_id)
    .order('sort_order')
  if (!all) return
  const i = all.findIndex((c) => c.id === id)
  const j = dir === 'up' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= all.length) return

  // Re-space everything so equal sort_orders can't get stuck.
  const ordered = all.map((c) => c.id)
  ;[ordered[i], ordered[j]] = [ordered[j], ordered[i]]
  const current = new Map(all.map((c) => [c.id, c.sort_order]))
  await Promise.all(
    ordered
      .map((cid, idx) => ({ cid, sort_order: (idx + 1) * 10 }))
      .filter(({ cid, sort_order }) => current.get(cid) !== sort_order)
      .map(({ cid, sort_order }) => supabase.from('staff_categories').update({ sort_order }).eq('id', cid)),
  )
  refresh()
}
