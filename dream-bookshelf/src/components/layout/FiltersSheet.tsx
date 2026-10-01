import { LayoutGrid, List } from 'lucide-react'
import { useSettings, type SortKey } from '../../store/settings'
import { useUI, type Sheet } from '../../store/ui'
import { Drawer } from '../ui/Drawer'
import { Chip } from '../ui/Chip'
import { Label } from '../ui/Field'
import { Switch } from '../ui/Switch'
import { Segmented } from '../ui/Segmented'
import { Button } from '../ui/Button'
import { CategoryPicker } from '../categories/CategoryPicker'

export const SORTS: Array<{ value: SortKey; label: string }> = [
  { value: 'recent', label: 'Recently added' },
  { value: 'title', label: 'Title' },
  { value: 'author', label: 'Author' },
  { value: 'year', label: 'Newest published' },
  { value: 'price', label: 'Price' },
  { value: 'series', label: 'Series order' },
]

export function FiltersSheet({ sheet, depth, isTop }: { sheet: Extract<Sheet, { kind: 'filters' }>; depth: number; isTop: boolean }) {
  const closeSheet = useUI((s) => s.closeSheet)
  const filters = useUI((s) => s.filters)
  const setFilters = useUI((s) => s.setFilters)
  const resetFilters = useUI((s) => s.resetFilters)
  const { sort, view, showSeriesVolumes, set } = useSettings()

  return (
    <Drawer
      open={!sheet.closing}
      onClose={() => closeSheet(sheet.key)}
      depth={depth}
      isTop={isTop}
      title="View & filters"
      headerRight={
        <Button size="sm" variant="ghost" onClick={resetFilters}>
          Reset
        </Button>
      }
    >
      <div className="space-y-6 pt-1">
        <div>
          <Label>Layout</Label>
          <Segmented
            label="Layout"
            value={view}
            onChange={(v) => set({ view: v })}
            options={[
              { value: 'grid', label: 'Covers', icon: <LayoutGrid size={15} /> },
              { value: 'list', label: 'List', icon: <List size={15} /> },
            ]}
          />
        </div>
        <div>
          <Label>Sort by</Label>
          <div className="flex flex-wrap gap-2">
            {SORTS.map((s) => (
              <Chip key={s.value} active={sort === s.value} onClick={() => set({ sort: s.value })}>
                {s.label}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          <Label>Category</Label>
          <CategoryPicker
            value={{ categoryId: filters.categoryId, subCategoryId: filters.subCategoryId }}
            onChange={(v) => setFilters({ categoryId: v.categoryId, subCategoryId: v.subCategoryId })}
          />
        </div>
        <Switch
          checked={showSeriesVolumes}
          onChange={(v) => set({ showSeriesVolumes: v })}
          label="Show series volumes on shelves"
          description="Turn off to keep sagas tidy in the Series tab only."
        />
      </div>
    </Drawer>
  )
}
