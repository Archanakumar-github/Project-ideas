import { useState } from 'react'
import { Bookmark } from 'lucide-react'
import {
  addCategory,
  addShelf,
  deleteCategory,
  deleteShelf,
  renameCategory,
  renameShelf,
  reorderCategories,
  reorderShelves,
} from '../../db/repo'
import { useLibrary } from '../../hooks/useLibrary'
import { ui, useUI } from '../../store/ui'
import { pluralize } from '../../lib/utils'
import { SortableList } from './SortableList'
import { ManagerRow } from './ManagerRow'
import { InlineCreate } from './InlineCreate'

function useShowBooks() {
  const setFilters = useUI((s) => s.setFilters)
  const setTab = useUI((s) => s.setTab)
  const closeAll = useUI((s) => s.closeAllSheets)
  return (filters: { categoryId?: string; subCategoryId?: string; shelfId?: string }) => {
    setFilters({ status: 'all', categoryId: undefined, subCategoryId: undefined, shelfId: undefined, ...filters })
    setTab('shelves')
    closeAll()
  }
}

/** Add / rename / drag-reorder / delete main categories and their sub-categories. */
export function CategoryManager() {
  const lib = useLibrary()
  const [expanded, setExpanded] = useState<string | null>(null)
  const showBooks = useShowBooks()

  const confirmDelete = async (id: string, name: string, isTop: boolean) => {
    const count = lib.categoryCounts.get(id) ?? 0
    const subs = isTop ? (lib.subCategories.get(id)?.length ?? 0) : 0
    const parts = [
      subs ? `its ${pluralize(subs, 'sub-category', 'sub-categories')}` : '',
      count ? `${pluralize(count, 'book')} will become uncategorized` : '',
    ].filter(Boolean)
    const ok = await ui.confirm({
      title: `Delete “${name}”?`,
      message: parts.length ? `This also removes ${parts.join(', and ')}. Books themselves are kept.` : 'Books are never deleted.',
      confirmLabel: 'Delete',
      tone: 'danger',
    })
    if (ok) {
      await deleteCategory(id)
      ui.toast({ message: `Deleted “${name}”`, tone: 'success' })
    }
  }

  return (
    <div>
      <SortableList
        items={lib.topCategories}
        onReorder={(ids) => void reorderCategories(ids)}
        renderItem={(cat, handle) => {
          const subs = lib.subCategories.get(cat.id) ?? []
          const isOpen = expanded === cat.id
          return (
            <div>
              <ManagerRow
                name={cat.name}
                count={lib.categoryCounts.get(cat.id) ?? 0}
                handle={handle}
                expanded={isOpen}
                onToggle={() => setExpanded(isOpen ? null : cat.id)}
                onRename={(name) => void renameCategory(cat.id, name)}
                onDelete={() => void confirmDelete(cat.id, cat.name, true)}
                onViewBooks={() => showBooks({ categoryId: cat.id })}
              />
              {isOpen && (
                <div className="animate-fade-in mt-2 mb-1 ml-5 border-l-2 border-amber/25 pl-3">
                  {subs.length === 0 && <p className="py-2 text-sm text-ink-faint">No sub-categories yet.</p>}
                  <SortableList
                    items={subs}
                    onReorder={(ids) => void reorderCategories(ids)}
                    renderItem={(sub, subHandle) => (
                      <ManagerRow
                        compact
                        name={sub.name}
                        count={lib.categoryCounts.get(sub.id) ?? 0}
                        handle={subHandle}
                        onRename={(name) => void renameCategory(sub.id, name)}
                        onDelete={() => void confirmDelete(sub.id, sub.name, false)}
                        onViewBooks={() => showBooks({ categoryId: cat.id, subCategoryId: sub.id })}
                      />
                    )}
                  />
                  <InlineCreate
                    className="mt-2"
                    label="Add sub-category"
                    placeholder={`e.g. under ${cat.name}`}
                    onCreate={(name) => addCategory(name, cat.id)}
                  />
                </div>
              )}
            </div>
          )
        }}
      />
      <InlineCreate
        className="mt-3"
        label="Add category"
        placeholder="e.g. Cozy Mystery"
        onCreate={async (name) => {
          const c = await addCategory(name)
          setExpanded(c.id)
        }}
      />
    </div>
  )
}

/** Add / rename / drag-reorder / delete custom shelves (quick-filter tags). */
export function ShelfManager() {
  const lib = useLibrary()
  const showBooks = useShowBooks()
  return (
    <div>
      <SortableList
        items={lib.orderedShelves}
        onReorder={(ids) => void reorderShelves(ids)}
        renderItem={(shelf, handle) => (
          <ManagerRow
            name={shelf.name}
            icon={<Bookmark size={15} />}
            count={lib.shelfCounts.get(shelf.id) ?? 0}
            handle={handle}
            onRename={(name) => void renameShelf(shelf.id, name)}
            onViewBooks={() => showBooks({ shelfId: shelf.id })}
            onDelete={async () => {
              const ok = await ui.confirm({
                title: `Delete shelf “${shelf.name}”?`,
                message: 'Books on it stay in your library; only the tag is removed.',
                confirmLabel: 'Delete',
                tone: 'danger',
              })
              if (ok) await deleteShelf(shelf.id)
            }}
          />
        )}
      />
      <InlineCreate className="mt-3" label="Add shelf" placeholder="e.g. Winter Reads" onCreate={(name) => addShelf(name)} />
    </div>
  )
}
