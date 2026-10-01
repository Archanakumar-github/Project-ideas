import { useCallback } from 'react'
import type { Book } from '../../db/types'
import { categoryLabel, useLibrary } from '../../hooks/useLibrary'
import { useUI } from '../../store/ui'
import { cx } from '../../lib/utils'
import { BookCard } from './BookCard'

/** Grid (2–4 columns by width) or list of book cards, wired to sheets & multi-select. */
export function BookCollection({ books, layout }: { books: Book[]; layout: 'grid' | 'list' }) {
  const lib = useLibrary()
  const selecting = useUI((s) => s.selecting)
  const selected = useUI((s) => s.selected)
  const openSheet = useUI((s) => s.openSheet)
  const toggleSelected = useUI((s) => s.toggleSelected)

  const onOpen = useCallback((b: Book) => openSheet({ kind: 'book', id: b.id }), [openSheet])
  const onActions = useCallback(
    (b: Book) => {
      if (useUI.getState().selecting) toggleSelected(b.id)
      else openSheet({ kind: 'book-actions', id: b.id })
    },
    [openSheet, toggleSelected],
  )
  const onToggle = useCallback((b: Book) => toggleSelected(b.id), [toggleSelected])
  const selectedSet = new Set(selected)

  return (
    <div
      className={cx(
        layout === 'grid'
          ? 'grid grid-cols-2 gap-x-4 gap-y-6 min-[420px]:grid-cols-3 sm:grid-cols-4'
          : 'flex flex-col gap-2.5',
      )}
    >
      {books.map((b) => (
        <BookCard
          key={b.id}
          book={b}
          layout={layout}
          selecting={selecting}
          selected={selectedSet.has(b.id)}
          seriesTitle={b.seriesId ? lib.seriesById.get(b.seriesId)?.title : undefined}
          categoryText={layout === 'list' ? categoryLabel(lib, b.categoryId, b.subCategoryId) : undefined}
          onOpen={onOpen}
          onActions={onActions}
          onToggleSelect={onToggle}
        />
      ))}
    </div>
  )
}
