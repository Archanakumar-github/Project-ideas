/** Pure, synchronous library helpers (filter / sort / search / stats). Easy to unit test. */
import type { Book, Category, Series, Shelf } from '../db/types'
import type { SortKey } from '../store/settings'
import type { ShelfFilters } from '../store/ui'
import { normalize, titleKey } from './utils'

export function filterBooks(
  books: Book[],
  f: ShelfFilters,
  { showSeriesVolumes = true }: { showSeriesVolumes?: boolean } = {},
): Book[] {
  return books.filter(
    (b) =>
      (f.status === 'all' || b.status === f.status) &&
      (!f.categoryId || b.categoryId === f.categoryId) &&
      (!f.subCategoryId || b.subCategoryId === f.subCategoryId) &&
      (!f.shelfId || b.shelfIds.includes(f.shelfId)) &&
      (showSeriesVolumes || !b.seriesId),
  )
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true })

function authorKey(b: Book): string {
  const first = b.authors[0] ?? ''
  const parts = normalize(first).split(' ')
  return `${parts[parts.length - 1] ?? ''} ${parts.slice(0, -1).join(' ')}`
}

export function sortBooks(books: Book[], sort: SortKey, seriesById?: Map<string, Series>): Book[] {
  const list = [...books]
  const byTitle = (a: Book, b: Book) => collator.compare(titleKey(a.title), titleKey(b.title))
  switch (sort) {
    case 'title':
      return list.sort(byTitle)
    case 'author':
      return list.sort((a, b) => collator.compare(authorKey(a), authorKey(b)) || byTitle(a, b))
    case 'year':
      return list.sort((a, b) => (b.publishYear ?? -Infinity) - (a.publishYear ?? -Infinity) || byTitle(a, b))
    case 'price':
      return list.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity) || byTitle(a, b))
    case 'series':
      return list.sort((a, b) => {
        const sa = a.seriesId ? seriesById?.get(a.seriesId)?.title : undefined
        const sb = b.seriesId ? seriesById?.get(b.seriesId)?.title : undefined
        if (sa && sb) return collator.compare(sa, sb) || (a.seriesIndex ?? 0) - (b.seriesIndex ?? 0)
        if (sa) return -1
        if (sb) return 1
        return byTitle(a, b)
      })
    case 'recent':
    default:
      return list.sort((a, b) => b.createdAt - a.createdAt)
  }
}

export interface SearchContext {
  categoriesById: Map<string, Category>
  shelvesById: Map<string, Shelf>
  seriesById: Map<string, Series>
}

/** Local, instant search over everything a user might remember about a book. */
export function searchLocal(books: Book[], query: string, ctx: SearchContext): Book[] {
  const q = normalize(query)
  if (!q) return []
  const terms = q.split(' ')
  const scored: Array<{ book: Book; score: number }> = []
  for (const b of books) {
    const title = normalize(`${b.title} ${b.subtitle ?? ''}`)
    const authors = normalize(b.authors.join(' '))
    const series = b.seriesId ? normalize(ctx.seriesById.get(b.seriesId)?.title) : ''
    const rest = normalize(
      [
        b.isbn,
        b.notes,
        b.categoryId && ctx.categoriesById.get(b.categoryId)?.name,
        b.subCategoryId && ctx.categoriesById.get(b.subCategoryId)?.name,
        ...b.shelfIds.map((id) => ctx.shelvesById.get(id)?.name),
      ]
        .filter(Boolean)
        .join(' '),
    )
    const hay = `${title} ${authors} ${series} ${rest}`
    if (!terms.every((t) => hay.includes(t))) continue
    let score = 1
    if (title.startsWith(q)) score += 6
    else if (title.includes(q)) score += 4
    if (authors.includes(q)) score += 3
    if (series.includes(q)) score += 2
    scored.push({ book: b, score })
  }
  return scored.sort((a, b) => b.score - a.score || a.book.title.localeCompare(b.book.title)).map((s) => s.book)
}

export function searchSeriesLocal(series: Series[], query: string): Series[] {
  const q = normalize(query)
  if (!q) return []
  return series.filter((s) => normalize(`${s.title} ${s.authors.join(' ')}`).includes(q))
}

export function sortVolumes(volumes: Book[]): Book[] {
  return [...volumes].sort(
    (a, b) => (a.seriesIndex ?? Infinity) - (b.seriesIndex ?? Infinity) || a.createdAt - b.createdAt,
  )
}

export interface SeriesStats {
  /** Max of planned total, volumes added, and highest volume number. */
  total: number
  added: number
  owned: number
  wantToRead: number
  wantToBuy: number
  /** Volume numbers (1..total) with no book yet. */
  missing: number[]
}

export function seriesStats(series: Pick<Series, 'totalVolumes'>, volumes: Book[]): SeriesStats {
  const maxIndex = volumes.reduce((m, v) => Math.max(m, Math.floor(v.seriesIndex ?? 0)), 0)
  const total = Math.max(series.totalVolumes ?? 0, volumes.length, maxIndex)
  const present = new Set(volumes.map((v) => v.seriesIndex).filter((i): i is number => i !== undefined))
  const missing: number[] = []
  if (series.totalVolumes) {
    for (let i = 1; i <= series.totalVolumes; i++) if (!present.has(i)) missing.push(i)
  }
  return {
    total,
    added: volumes.length,
    owned: volumes.filter((v) => v.status === 'owned').length,
    wantToRead: volumes.filter((v) => v.status === 'want-to-read').length,
    wantToBuy: volumes.filter((v) => v.status === 'want-to-buy').length,
    missing,
  }
}

/** Sum of Want-to-Buy prices per currency ("Wishlist value"). */
export function wishlistTotals(books: Book[]): Array<{ currency: string; amount: number; count: number }> {
  const totals = new Map<string, { amount: number; count: number }>()
  for (const b of books) {
    if (b.status !== 'want-to-buy' || b.price === undefined) continue
    const cur = b.currency ?? 'USD'
    const t = totals.get(cur) ?? { amount: 0, count: 0 }
    t.amount += b.price
    t.count++
    totals.set(cur, t)
  }
  return Array.from(totals, ([currency, t]) => ({ currency, ...t })).sort((a, b) => b.count - a.count)
}

/** Possible duplicates of a candidate already in the library (same ISBN or same title+author). */
export function findDuplicate(
  books: Book[],
  c: { title: string; authors: string[]; isbn?: string },
): Book | undefined {
  const tk = titleKey(c.title)
  const author = normalize(c.authors[0] ?? '').split(' ').pop() ?? ''
  return books.find(
    (b) =>
      (c.isbn && b.isbn === c.isbn) ||
      (titleKey(b.title) === tk && (!author || normalize(b.authors[0] ?? '').split(' ').pop() === author)),
  )
}
