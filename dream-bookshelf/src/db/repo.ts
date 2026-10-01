import { buildDefaultTaxonomy, db } from './db'
import type {
  Book,
  BookDraft,
  BookStatus,
  Category,
  Cover,
  Series,
  SeriesDraft,
  SeriesStatus,
  Shelf,
} from './types'
import { titleKey, uid, uniq, uniqText } from '../lib/utils'
import { toIsbn13 } from '../lib/isbn'
import { enqueueTask, requestSync } from '../sync/enqueue'
import { getSettings } from '../store/settings'

/* ------------------------------------------------------------------------------------------
 * Books
 * ---------------------------------------------------------------------------------------- */

function cleanText(v: string | undefined): string | undefined {
  const t = v?.trim()
  return t ? t : undefined
}

function sanitizeBookFields<T extends Partial<Book>>(input: T): T {
  const out: Partial<Book> = { ...input }
  if ('title' in out && out.title !== undefined) out.title = out.title.trim()
  if ('subtitle' in out) out.subtitle = cleanText(out.subtitle)
  if ('authors' in out && out.authors) out.authors = uniqText(out.authors)
  if ('isbn' in out) out.isbn = toIsbn13(out.isbn) ?? cleanText(out.isbn)
  if ('notes' in out) out.notes = cleanText(out.notes)
  if ('link' in out) out.link = cleanText(out.link)
  if ('description' in out) out.description = cleanText(out.description)
  if ('shelfIds' in out && out.shelfIds) out.shelfIds = uniq(out.shelfIds)
  if ('categoryId' in out && !out.categoryId) out.categoryId = undefined
  if ('subCategoryId' in out && !out.subCategoryId) out.subCategoryId = undefined
  if ('seriesId' in out && !out.seriesId) {
    out.seriesId = undefined
    out.seriesIndex = undefined
  }
  return out as T
}

export interface CreateBookOptions {
  /** A user-supplied cover image (already compressed). */
  coverBlob?: Blob
  /** Queue a background metadata lookup (offline add / placeholder). */
  enrich?: boolean
}

export async function createBook(draft: BookDraft, opts: CreateBookOptions = {}): Promise<Book> {
  const now = Date.now()
  const settings = getSettings()
  const base = sanitizeBookFields(draft)
  const book: Book = {
    ...base,
    id: uid(),
    title: base.title || 'Untitled',
    authors: base.authors ?? [],
    status: base.status ?? settings.lastStatus ?? 'want-to-read',
    shelfIds: base.shelfIds ?? [],
    source: base.source ?? 'manual',
    metadataState: opts.enrich ? 'pending' : (base.metadataState ?? 'complete'),
    currency: base.currency ?? (base.price !== undefined ? settings.currency : undefined),
    createdAt: now,
    updatedAt: now,
  }

  let queued = false
  await db.transaction('rw', db.books, db.covers, db.syncQueue, async () => {
    if (opts.coverBlob) {
      const cover = makeCover(opts.coverBlob, 'upload')
      await db.covers.add(cover)
      book.coverId = cover.id
    }
    await db.books.add(book)
    if (opts.enrich && settings.onlineLookups) {
      await enqueueTask('enrich-book', book.id)
      queued = true
    } else if (book.coverUrl && !book.coverId && settings.cacheCovers) {
      await enqueueTask('cache-cover', book.id)
      queued = true
    }
  })
  if (queued) requestSync()
  void requestPersistentStorage()
  return book
}

export async function updateBook(id: string, patch: Partial<Book>): Promise<void> {
  const clean = sanitizeBookFields(patch)
  let queued = false
  await db.transaction('rw', db.books, db.syncQueue, async () => {
    const existing = await db.books.get(id)
    if (!existing) return
    await db.books.update(id, { ...clean, updatedAt: Date.now() })
    const coverChanged = clean.coverUrl && clean.coverUrl !== existing.coverUrl
    if (coverChanged && !existing.coverId && getSettings().cacheCovers) {
      await enqueueTask('cache-cover', id)
      queued = true
    }
  })
  if (queued) requestSync()
}

/** Apply the same change to many books (batch actions). */
export async function modifyBooks(ids: string[], change: (book: Book) => void): Promise<number> {
  if (ids.length === 0) return 0
  const now = Date.now()
  return db.books
    .where('id')
    .anyOf(ids)
    .modify((book) => {
      change(book)
      book.updatedAt = now
    })
}

export function setBooksStatus(ids: string[], status: BookStatus) {
  return modifyBooks(ids, (b) => {
    b.status = status
  })
}

export function moveBooksToCategory(ids: string[], categoryId?: string, subCategoryId?: string) {
  return modifyBooks(ids, (b) => {
    if (categoryId) b.categoryId = categoryId
    else delete b.categoryId
    if (subCategoryId) b.subCategoryId = subCategoryId
    else delete b.subCategoryId
  })
}

export function addBooksToShelf(ids: string[], shelfId: string) {
  return modifyBooks(ids, (b) => {
    if (!b.shelfIds.includes(shelfId)) b.shelfIds = [...b.shelfIds, shelfId]
  })
}

export function removeBooksFromShelf(ids: string[], shelfId: string) {
  return modifyBooks(ids, (b) => {
    b.shelfIds = b.shelfIds.filter((s) => s !== shelfId)
  })
}

export async function toggleBookShelf(id: string, shelfId: string) {
  const book = await db.books.get(id)
  if (!book) return
  const shelfIds = book.shelfIds.includes(shelfId)
    ? book.shelfIds.filter((s) => s !== shelfId)
    : [...book.shelfIds, shelfId]
  await db.books.update(id, { shelfIds, updatedAt: Date.now() })
}

/** Everything needed to undo a delete. */
export interface DeletedSnapshot {
  books: Book[]
  series: Series[]
  covers: Cover[]
}

export async function deleteBooks(ids: string[]): Promise<DeletedSnapshot> {
  return db.transaction('rw', db.books, db.covers, db.syncQueue, async () => {
    const books = (await db.books.bulkGet(ids)).filter((b): b is Book => !!b)
    const coverIds = books.map((b) => b.coverId).filter((c): c is string => !!c)
    const covers = (await db.covers.bulkGet(coverIds)).filter((c): c is Cover => !!c)
    await db.books.bulkDelete(ids)
    await db.covers.bulkDelete(coverIds)
    await db.syncQueue.where('entityId').anyOf(ids).delete()
    return { books, series: [], covers }
  })
}

export async function restoreSnapshot(snapshot: DeletedSnapshot): Promise<void> {
  await db.transaction('rw', db.books, db.series, db.covers, async () => {
    await db.covers.bulkPut(snapshot.covers)
    await db.series.bulkPut(snapshot.series)
    await db.books.bulkPut(snapshot.books)
  })
}

/* ------------------------------------------------------------------------------------------
 * Covers
 * ---------------------------------------------------------------------------------------- */

export function makeCover(blob: Blob, origin: Cover['origin'], sourceUrl?: string): Cover {
  return { id: uid(), blob, type: blob.type || 'image/jpeg', origin, sourceUrl, createdAt: Date.now() }
}

type CoverTarget = { kind: 'book' | 'series'; id: string }

function getCoverTarget(target: CoverTarget): Promise<Book | Series | undefined> {
  return target.kind === 'book' ? db.books.get(target.id) : db.series.get(target.id)
}

function patchCoverTarget(target: CoverTarget, coverId: string | undefined) {
  const updatedAt = Date.now()
  // Removing a book's cover also forgets its remote URL, so the placeholder shows.
  return target.kind === 'book'
    ? db.books.update(target.id, coverId ? { coverId, updatedAt } : { coverId, coverUrl: undefined, updatedAt })
    : db.series.update(target.id, { coverId, updatedAt })
}

/** Attach a local cover blob to a book or series, replacing (and deleting) any previous one. */
export async function setLocalCover(
  target: CoverTarget,
  blob: Blob,
  origin: Cover['origin'] = 'upload',
  sourceUrl?: string,
): Promise<string> {
  return db.transaction('rw', db.books, db.series, db.covers, async () => {
    const entity = await getCoverTarget(target)
    const cover = makeCover(blob, origin, sourceUrl)
    await db.covers.add(cover)
    if (entity?.coverId) await db.covers.delete(entity.coverId)
    await patchCoverTarget(target, cover.id)
    return cover.id
  })
}

export async function removeLocalCover(target: CoverTarget) {
  await db.transaction('rw', db.books, db.series, db.covers, async () => {
    const entity = await getCoverTarget(target)
    if (entity?.coverId) await db.covers.delete(entity.coverId)
    await patchCoverTarget(target, undefined)
  })
}

/* ------------------------------------------------------------------------------------------
 * Series
 * ---------------------------------------------------------------------------------------- */

export async function createSeries(draft: SeriesDraft, coverBlob?: Blob): Promise<Series> {
  const now = Date.now()
  const series: Series = {
    ...draft,
    id: uid(),
    title: draft.title.trim() || 'Untitled series',
    authors: uniqText(draft.authors ?? []),
    status: draft.status ?? 'want-to-read',
    shelfIds: uniq(draft.shelfIds ?? []),
    createdAt: now,
    updatedAt: now,
  }
  await db.transaction('rw', db.series, db.covers, async () => {
    if (coverBlob) {
      const cover = makeCover(coverBlob, 'upload')
      await db.covers.add(cover)
      series.coverId = cover.id
    }
    await db.series.add(series)
  })
  return series
}

export async function updateSeries(id: string, patch: Partial<Series>) {
  const clean: Partial<Series> = { ...patch }
  if (clean.title !== undefined) clean.title = clean.title.trim()
  if (clean.authors) clean.authors = uniqText(clean.authors)
  if ('categoryId' in clean && !clean.categoryId) clean.categoryId = undefined
  if ('subCategoryId' in clean && !clean.subCategoryId) clean.subCategoryId = undefined
  await db.series.update(id, { ...clean, updatedAt: Date.now() })
}

/** Match an existing series by (normalized) name, or create one. */
export async function findOrCreateSeries(
  title: string,
  authors: string[] = [],
  status: SeriesStatus = 'want-to-read',
): Promise<Series> {
  const key = titleKey(title)
  const all = await db.series.toArray()
  const existing = all.find((s) => titleKey(s.title) === key)
  if (existing) return existing
  return createSeries({ title, authors, status })
}

export async function deleteSeries(id: string, withVolumes: boolean): Promise<DeletedSnapshot> {
  return db.transaction('rw', db.series, db.books, db.covers, db.syncQueue, async () => {
    const series = await db.series.get(id)
    const volumes = await db.books.where('seriesId').equals(id).toArray()
    const coverIds = [
      series?.coverId,
      ...(withVolumes ? volumes.map((b) => b.coverId) : []),
    ].filter((c): c is string => !!c)
    const covers = (await db.covers.bulkGet(coverIds)).filter((c): c is Cover => !!c)

    await db.series.delete(id)
    await db.covers.bulkDelete(coverIds)
    if (withVolumes) {
      await db.books.bulkDelete(volumes.map((b) => b.id))
      await db.syncQueue.where('entityId').anyOf(volumes.map((b) => b.id)).delete()
    } else {
      await db.books
        .where('seriesId')
        .equals(id)
        .modify((b) => {
          delete b.seriesId
          delete b.seriesIndex
          b.updatedAt = Date.now()
        })
    }
    // Snapshot keeps the original volumes (with their seriesId) so undo fully restores.
    return { books: volumes, series: series ? [series] : [], covers }
  })
}

/** Next free volume number in a series (max + 1). */
export async function nextSeriesIndex(seriesId: string): Promise<number> {
  const volumes = await db.books.where('seriesId').equals(seriesId).toArray()
  const max = volumes.reduce((m, b) => Math.max(m, b.seriesIndex ?? 0), 0)
  return Math.floor(max) + 1
}

export async function setSeriesVolumesStatus(seriesId: string, status: BookStatus) {
  const ids = await db.books.where('seriesId').equals(seriesId).primaryKeys()
  return setBooksStatus(ids, status)
}

/* ------------------------------------------------------------------------------------------
 * Categories (two levels) & custom shelves
 * ---------------------------------------------------------------------------------------- */

export async function addCategory(name: string, parentId: string | null = null): Promise<Category> {
  const clean = name.trim()
  if (!clean) throw new Error('Category name is required')
  const siblings = (await db.categories.toArray()).filter((c) => c.parentId === parentId)
  const dupe = siblings.find((c) => c.name.toLowerCase() === clean.toLowerCase())
  if (dupe) return dupe
  const now = Date.now()
  const category: Category = {
    id: uid(),
    name: clean,
    parentId,
    order: siblings.reduce((m, c) => Math.max(m, c.order + 1), 0),
    createdAt: now,
    updatedAt: now,
  }
  await db.categories.add(category)
  return category
}

export async function renameCategory(id: string, name: string) {
  const clean = name.trim()
  if (!clean) return
  await db.categories.update(id, { name: clean, updatedAt: Date.now() })
}

/** Deletes a category (and its sub-categories if top-level); books keep everything else. */
export async function deleteCategory(id: string): Promise<number> {
  return db.transaction('rw', db.categories, db.books, db.series, async () => {
    const category = await db.categories.get(id)
    if (!category) return 0
    const now = Date.now()
    let affected = 0
    if (category.parentId === null) {
      const childIds = (await db.categories.toArray()).filter((c) => c.parentId === id).map((c) => c.id)
      await db.categories.bulkDelete([id, ...childIds])
      const clear = (e: Book | Series) => {
        delete e.categoryId
        delete e.subCategoryId
        e.updatedAt = now
      }
      affected += await db.books.where('categoryId').equals(id).modify(clear)
      affected += await db.series.where('categoryId').equals(id).modify(clear)
    } else {
      await db.categories.delete(id)
      affected += await db.books
        .where('subCategoryId')
        .equals(id)
        .modify((b) => {
          delete b.subCategoryId
          b.updatedAt = now
        })
      affected += await db.series
        .filter((s) => s.subCategoryId === id)
        .modify((s) => {
          delete s.subCategoryId
          s.updatedAt = now
        })
    }
    return affected
  })
}

/** Persist a new order for siblings (drag-and-drop). */
export async function reorderCategories(orderedIds: string[]) {
  await db.transaction('rw', db.categories, async () => {
    await Promise.all(orderedIds.map((id, order) => db.categories.update(id, { order })))
  })
}

export async function addShelf(name: string): Promise<Shelf> {
  const clean = name.trim()
  if (!clean) throw new Error('Shelf name is required')
  const all = await db.shelves.toArray()
  const dupe = all.find((s) => s.name.toLowerCase() === clean.toLowerCase())
  if (dupe) return dupe
  const now = Date.now()
  const shelf: Shelf = {
    id: uid(),
    name: clean,
    order: all.reduce((m, s) => Math.max(m, s.order + 1), 0),
    createdAt: now,
    updatedAt: now,
  }
  await db.shelves.add(shelf)
  return shelf
}

export async function renameShelf(id: string, name: string) {
  const clean = name.trim()
  if (!clean) return
  await db.shelves.update(id, { name: clean, updatedAt: Date.now() })
}

export async function deleteShelf(id: string): Promise<number> {
  return db.transaction('rw', db.shelves, db.books, db.series, async () => {
    await db.shelves.delete(id)
    const now = Date.now()
    const strip = (e: { shelfIds: string[]; updatedAt: number }) => {
      e.shelfIds = e.shelfIds.filter((s) => s !== id)
      e.updatedAt = now
    }
    const a = await db.books.where('shelfIds').equals(id).modify(strip)
    const b = await db.series.where('shelfIds').equals(id).modify(strip)
    return a + b
  })
}

export async function reorderShelves(orderedIds: string[]) {
  await db.transaction('rw', db.shelves, async () => {
    await Promise.all(orderedIds.map((id, order) => db.shelves.update(id, { order })))
  })
}

/* ------------------------------------------------------------------------------------------
 * Library-wide
 * ---------------------------------------------------------------------------------------- */

export async function eraseEverything() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((t) => t.clear()))
    const { categories, shelves } = buildDefaultTaxonomy()
    await db.categories.bulkAdd(categories)
    await db.shelves.bulkAdd(shelves)
  })
}

let persistRequested = false
/** Ask the browser not to evict our data under storage pressure (once per session). */
export async function requestPersistentStorage(): Promise<boolean> {
  if (persistRequested || typeof navigator === 'undefined' || !navigator.storage?.persist) return false
  persistRequested = true
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}
