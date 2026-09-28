import type { Metadata } from 'next'
import { PageHeader, Panel } from '@/components/portal/portal-shell'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { CategoryRow, NewCategoryForm } from './category-forms'

export const metadata: Metadata = { title: 'Service categories' }

export default async function CategoriesPage() {
  const session = await requireRole('super_admin')
  const supabase = await createClient()
  const [{ data: categories }, { data: staff }] = await Promise.all([
    supabase.from('staff_categories').select('id, name, slug, description, icon, is_active, sort_order').eq('agency_id', session.agency_id).order('sort_order'),
    supabase.from('staff_profiles').select('category_id').eq('agency_id', session.agency_id),
  ])

  const counts = new Map<string, number>()
  for (const s of staff ?? []) counts.set(s.category_id, (counts.get(s.category_id) ?? 0) + 1)
  const rows = (categories ?? []).map((c) => ({ ...c, staffCount: counts.get(c.id) ?? 0 }))

  return (
    <div className="grid gap-8">
      <PageHeader
        title="Service categories"
        description="Every role you staff, from house helps to security guards. Changes go live on the website immediately. No code changes needed."
      />
      <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Panel title={`${rows.length} categories`}>
          <ul className="grid gap-2">
            {rows.map((c, i) => (
              <CategoryRow key={c.id} category={c} first={i === 0} last={i === rows.length - 1} />
            ))}
          </ul>
        </Panel>
        <Panel title="Add a category">
          <NewCategoryForm />
        </Panel>
      </div>
    </div>
  )
}
