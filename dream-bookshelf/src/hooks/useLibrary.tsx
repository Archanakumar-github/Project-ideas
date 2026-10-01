import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Book, BookStatus, Category, Series, Shelf } from '../db/types'
import { sortVolumes } from '../lib/library'
import { uniqText } from '../lib/utils'

export interface Library {
  ready: boolean
  books: Book[]
  series: Series[]
  categories: Category[]
  shelves: Shelf[]
  booksById: Map<string, Book>
  seriesById: Map<string, Series>
  categoriesById: Map<string, Category>
  shelvesById: Map<string, Shelf>
  /** Main categories, in user order. */
  topCategories: Category[]
  /** Sub-categories per main category id, in user order. */
  subCategories: Map<string, Category[]>
  /** Shelves in user order. */
  orderedShelves: Shelf[]
  /** Volumes per series id, sorted by volume number. */
  volumesBySeries: Map<string, Book[]>
  authors: string[]
  statusCounts: Record<'all' | BookStatus, number>
  categoryCounts: Map<string, number>
  shelfCounts: Map<string, number>
}

const LibraryContext = createContext<Library | null>(null)

const byOrder = (a: { order: number; name: string }, b: { order: number; name: string }) =>
  a.order - b.order || a.name.localeCompare(b.name)

/**
 * One live subscription per table for the whole app. Dexie re-runs these queries whenever a
 * write touches the table (from any tab or component), so every view stays in sync for free.
 */
export function LibraryProvider({ children }: { children: ReactNode }) {
  const books = useLiveQuery(() => db.books.toArray(), [])
  const series = useLiveQuery(() => db.series.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const shelves = useLiveQuery(() => db.shelves.toArray(), [])

  const value = useMemo<Library>(() => {
    const b = books ?? []
    const s = series ?? []
    const c = categories ?? []
    const sh = shelves ?? []

    const topCategories = c.filter((x) => x.parentId === null).sort(byOrder)
    const subCategories = new Map<string, Category[]>()
    for (const cat of c) {
      if (cat.parentId === null) continue
      const list = subCategories.get(cat.parentId) ?? []
      list.push(cat)
      subCategories.set(cat.parentId, list)
    }
    subCategories.forEach((list) => list.sort(byOrder))

    const volumesBySeries = new Map<string, Book[]>()
    const statusCounts = { all: b.length, 'want-to-read': 0, 'want-to-buy': 0, owned: 0 }
    const categoryCounts = new Map<string, number>()
    const shelfCounts = new Map<string, number>()
    const bump = (m: Map<string, number>, k: string | undefined) => k && m.set(k, (m.get(k) ?? 0) + 1)
    for (const book of b) {
      statusCounts[book.status]++
      bump(categoryCounts, book.categoryId)
      bump(categoryCounts, book.subCategoryId)
      book.shelfIds.forEach((id) => bump(shelfCounts, id))
      if (book.seriesId) {
        const list = volumesBySeries.get(book.seriesId) ?? []
        list.push(book)
        volumesBySeries.set(book.seriesId, list)
      }
    }
    volumesBySeries.forEach((list, id) => volumesBySeries.set(id, sortVolumes(list)))

    return {
      ready: books !== undefined && series !== undefined && categories !== undefined && shelves !== undefined,
      books: b,
      series: s,
      categories: c,
      shelves: sh,
      booksById: new Map(b.map((x) => [x.id, x])),
      seriesById: new Map(s.map((x) => [x.id, x])),
      categoriesById: new Map(c.map((x) => [x.id, x])),
      shelvesById: new Map(sh.map((x) => [x.id, x])),
      topCategories,
      subCategories,
      orderedShelves: [...sh].sort(byOrder),
      volumesBySeries,
      authors: uniqText([...b.flatMap((x) => x.authors), ...s.flatMap((x) => x.authors)]).sort((x, y) =>
        x.localeCompare(y),
      ),
      statusCounts,
      categoryCounts,
      shelfCounts,
    }
  }, [books, series, categories, shelves])

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
}

export function useLibrary(): Library {
  const lib = useContext(LibraryContext)
  if (!lib) throw new Error('useLibrary must be used inside <LibraryProvider>')
  return lib
}

/** "Sci-Fi › Space Opera" */
export function categoryLabel(lib: Library, categoryId?: string, subCategoryId?: string): string | undefined {
  const top = categoryId ? lib.categoriesById.get(categoryId)?.name : undefined
  const sub = subCategoryId ? lib.categoriesById.get(subCategoryId)?.name : undefined
  if (top && sub) return `${top} › ${sub}`
  return top ?? sub
}
