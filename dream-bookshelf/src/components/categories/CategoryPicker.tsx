import { Settings2 } from 'lucide-react'
import { addCategory } from '../../db/repo'
import { useLibrary } from '../../hooks/useLibrary'
import { useUI } from '../../store/ui'
import { Chip } from '../ui/Chip'
import { InlineCreate } from './InlineCreate'

export interface CategoryValue {
  categoryId?: string
  subCategoryId?: string
}

/**
 * Two-level picker: main categories as chips, then the chosen category's sub-categories.
 * New categories can be created inline, and the full manager opens on top of the current sheet.
 */
export function CategoryPicker({
  value,
  onChange,
  showManage = true,
}: {
  value: CategoryValue
  onChange: (value: CategoryValue) => void
  showManage?: boolean
}) {
  const lib = useLibrary()
  const openSheet = useUI((s) => s.openSheet)
  const subs = value.categoryId ? (lib.subCategories.get(value.categoryId) ?? []) : []

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Chip active={!value.categoryId} onClick={() => onChange({})}>
          None
        </Chip>
        {lib.topCategories.map((c) => (
          <Chip
            key={c.id}
            active={value.categoryId === c.id}
            onClick={() => onChange(value.categoryId === c.id ? {} : { categoryId: c.id })}
          >
            {c.name}
          </Chip>
        ))}
        <InlineCreate
          label="Category"
          placeholder="New category"
          onCreate={async (name) => {
            const cat = await addCategory(name)
            onChange({ categoryId: cat.id })
          }}
        />
        {showManage && (
          <button
            type="button"
            onClick={() => openSheet({ kind: 'categories' })}
            className="press inline-flex min-h-9 items-center gap-1 rounded-full px-2.5 text-sm text-ink-faint hover:text-amber"
          >
            <Settings2 size={14} /> Manage
          </button>
        )}
      </div>

      {value.categoryId && (
        <div className="animate-fade-in flex flex-wrap items-center gap-2 border-l-2 border-amber/30 pl-3">
          {subs.map((c) => (
            <Chip
              key={c.id}
              tone="var(--color-amber-glow)"
              active={value.subCategoryId === c.id}
              onClick={() =>
                onChange({ categoryId: value.categoryId, subCategoryId: value.subCategoryId === c.id ? undefined : c.id })
              }
            >
              {c.name}
            </Chip>
          ))}
          <InlineCreate
            label="Sub-category"
            placeholder="New sub-category"
            onCreate={async (name) => {
              const sub = await addCategory(name, value.categoryId!)
              onChange({ categoryId: value.categoryId, subCategoryId: sub.id })
            }}
          />
        </div>
      )}
    </div>
  )
}
