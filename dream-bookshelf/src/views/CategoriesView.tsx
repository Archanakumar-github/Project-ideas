import { useCallback, useRef, useState } from 'react'
import { useLibrary } from '../hooks/useLibrary'
import { useSwipeTabs } from '../hooks/useSwipeTabs'
import { pluralize } from '../lib/utils'
import { ViewHeader } from '../components/layout/ViewHeader'
import { CategoryManager, ShelfManager } from '../components/categories/CategoryManager'
import { Segmented } from '../components/ui/Segmented'
import { useSlideDirection } from './useDirectionalKey'

type Mode = 'categories' | 'shelves'

export function CategoriesView({ active }: { active: boolean }) {
  const lib = useLibrary()
  const [mode, setMode] = useState<Mode>('categories')
  const swipeRef = useRef<HTMLDivElement>(null)
  const slide = useSlideDirection(mode === 'categories' ? 0 : 1)
  const toShelves = useCallback(() => setMode('shelves'), [])
  const toCategories = useCallback(() => setMode('categories'), [])
  useSwipeTabs(swipeRef, { onNext: toShelves, onPrev: toCategories, enabled: active })

  const subCount = lib.categories.length - lib.topCategories.length
  return (
    <div data-scroller className="h-full overflow-y-auto overscroll-y-contain">
      <ViewHeader
        title="Categories"
        subtitle={`${pluralize(lib.topCategories.length, 'genre')} · ${pluralize(subCount, 'sub-genre')} · ${pluralize(lib.shelves.length, 'shelf', 'shelves')}`}
      >
        <Segmented
          label="Organize"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'categories', label: 'Genres', count: lib.topCategories.length },
            { value: 'shelves', label: 'Custom shelves', count: lib.shelves.length },
          ]}
        />
      </ViewHeader>
      <div ref={swipeRef} className="min-h-[60vh] px-4" style={{ paddingBottom: 'calc(var(--nav-h) + env(safe-area-inset-bottom) + 32px)' }}>
        <div key={mode} className={slide}>
          <p className="mb-4 text-[13px] leading-relaxed text-ink-muted">
            {mode === 'categories'
              ? 'Tap a genre to see its sub-genres. Drag the handle to reorder; tap a count to browse those books.'
              : 'Shelves are quick-filter tags like “Top Priority” or “Signed Editions”. A book can sit on many.'}
          </p>
          {mode === 'categories' ? <CategoryManager /> : <ShelfManager />}
        </div>
      </div>
    </div>
  )
}
