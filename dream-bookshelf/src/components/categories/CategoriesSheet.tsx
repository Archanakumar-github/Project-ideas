import { useState } from 'react'
import { useUI, type Sheet } from '../../store/ui'
import { Drawer } from '../ui/Drawer'
import { Segmented } from '../ui/Segmented'
import { CategoryManager, ShelfManager } from './CategoryManager'

/** The full manager as a sheet — opened from any picker without leaving the current view. */
export function CategoriesSheet({ sheet, depth, isTop }: { sheet: Extract<Sheet, { kind: 'categories' }>; depth: number; isTop: boolean }) {
  const closeSheet = useUI((s) => s.closeSheet)
  const [mode, setMode] = useState<'categories' | 'shelves'>('categories')
  return (
    <Drawer open={!sheet.closing} onClose={() => closeSheet(sheet.key)} depth={depth} isTop={isTop} size="tall" title="Organize" subtitle="Drag the handle to reorder">
      <Segmented
        label="Manage"
        className="mb-4"
        value={mode}
        onChange={setMode}
        options={[
          { value: 'categories', label: 'Categories' },
          { value: 'shelves', label: 'Shelves' },
        ]}
      />
      {mode === 'categories' ? <CategoryManager /> : <ShelfManager />}
    </Drawer>
  )
}
