import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import {
  addBooksToShelf,
  addCategory,
  createBook,
  createSeries,
  deleteBooks,
  deleteCategory,
  deleteSeries,
  deleteShelf,
  findOrCreateSeries,
  moveBooksToCategory,
  nextSeriesIndex,
  reorderCategories,
  restoreSnapshot,
  setBooksStatus,
} from './repo'
import { useSettings } from '../store/settings'

beforeEach(async () => {
  await db.delete()
  await db.open()
  useSettings.setState({ cacheCovers: true, onlineLookups: true, lastStatus: 'want-to-read' })
})

describe('seeding', () => {
  it('creates a starter taxonomy and shelves on first open', async () => {
    const cats = await db.categories.toArray()
    expect(cats.some((c) => c.name === 'Sci-Fi' && c.parentId === null)).toBe(true)
    const scifi = cats.find((c) => c.name === 'Sci-Fi')!
    expect(cats.filter((c) => c.parentId === scifi.id).map((c) => c.name)).toContain('Cyberpunk')
    expect((await db.shelves.toArray()).map((s) => s.name)).toContain('Top Priority')
  })
})

describe('books', () => {
  it('normalizes input and defaults sensibly', async () => {
    const b = await createBook({ title: '  Dune ', authors: ['Frank Herbert', 'frank herbert', ' '], isbn: '0-441-17271-7' })
    expect(b.title).toBe('Dune')
    expect(b.authors).toEqual(['Frank Herbert'])
    expect(b.isbn).toBe('9780441172719')
    expect(b.status).toBe('want-to-read')
    expect(b.metadataState).toBe('complete')
  })

  it('queues cover caching and enrichment', async () => {
    const withCover = await createBook({ title: 'A', coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg' })
    const pending = await createBook({ title: 'B' }, { enrich: true })
    const tasks = await db.syncQueue.toArray()
    expect(tasks.map((t) => [t.type, t.entityId])).toEqual([
      ['cache-cover', withCover.id],
      ['enrich-book', pending.id],
    ])
    expect(pending.metadataState).toBe('pending')
  })

  it('applies batch actions', async () => {
    const a = await createBook({ title: 'A' })
    const b = await createBook({ title: 'B' })
    const shelf = (await db.shelves.toArray())[0]
    const cat = await addCategory('Horror')
    const sub = await addCategory('Gothic', cat.id)
    await setBooksStatus([a.id, b.id], 'owned')
    await moveBooksToCategory([a.id, b.id], cat.id, sub.id)
    await addBooksToShelf([a.id, b.id], shelf.id)
    await addBooksToShelf([a.id], shelf.id) // idempotent
    const [ra, rb] = await db.books.bulkGet([a.id, b.id])
    expect(ra).toMatchObject({ status: 'owned', categoryId: cat.id, subCategoryId: sub.id, shelfIds: [shelf.id] })
    expect(rb?.shelfIds).toEqual([shelf.id])
  })

  it('deletes with an undo snapshot', async () => {
    const a = await createBook({ title: 'A' }, { coverBlob: new Blob(['img'], { type: 'image/jpeg' }) })
    const snap = await deleteBooks([a.id])
    expect(await db.books.count()).toBe(0)
    expect(await db.covers.count()).toBe(0)
    await restoreSnapshot(snap)
    expect((await db.books.get(a.id))?.coverId).toBe(snap.covers[0].id)
    expect(await db.covers.count()).toBe(1)
  })
})

describe('series', () => {
  it('finds series case-insensitively and ignoring articles', async () => {
    const s = await createSeries({ title: 'The Expanse', authors: ['James S. A. Corey'] })
    expect((await findOrCreateSeries('expanse')).id).toBe(s.id)
    expect((await findOrCreateSeries('Discworld')).id).not.toBe(s.id)
  })

  it('computes the next volume number', async () => {
    const s = await createSeries({ title: 'Mistborn' })
    expect(await nextSeriesIndex(s.id)).toBe(1)
    await createBook({ title: 'One', seriesId: s.id, seriesIndex: 1 })
    await createBook({ title: 'Novella', seriesId: s.id, seriesIndex: 2.5 })
    expect(await nextSeriesIndex(s.id)).toBe(3)
  })

  it('can delete a series but keep its books', async () => {
    const s = await createSeries({ title: 'Mistborn' })
    const b = await createBook({ title: 'One', seriesId: s.id, seriesIndex: 1 })
    const snap = await deleteSeries(s.id, false)
    const kept = await db.books.get(b.id)
    expect(kept?.seriesId).toBeUndefined()
    expect(kept?.seriesIndex).toBeUndefined()
    await restoreSnapshot(snap)
    expect((await db.books.get(b.id))?.seriesId).toBe(s.id)
    expect(await db.series.get(s.id)).toBeTruthy()
  })
})

describe('taxonomy', () => {
  it('avoids duplicate names among siblings and appends order', async () => {
    const a = await addCategory('Horror')
    const again = await addCategory(' horror ')
    expect(again.id).toBe(a.id)
    const top = (await db.categories.toArray()).filter((c) => c.parentId === null)
    expect(a.order).toBe(Math.max(...top.map((c) => c.order)))
  })

  it('reorders siblings', async () => {
    const top = (await db.categories.toArray()).filter((c) => c.parentId === null).sort((a, b) => a.order - b.order)
    const reversed = top.map((c) => c.id).reverse()
    await reorderCategories(reversed)
    const after = (await db.categories.toArray()).filter((c) => c.parentId === null).sort((a, b) => a.order - b.order)
    expect(after.map((c) => c.id)).toEqual(reversed)
  })

  it('deleting a category clears it from books (and removes its children)', async () => {
    const cat = await addCategory('Horror')
    const sub = await addCategory('Gothic', cat.id)
    const b = await createBook({ title: 'Dracula', categoryId: cat.id, subCategoryId: sub.id })
    expect(await deleteCategory(cat.id)).toBe(1)
    expect(await db.categories.get(sub.id)).toBeUndefined()
    const after = await db.books.get(b.id)
    expect(after?.categoryId).toBeUndefined()
    expect(after?.subCategoryId).toBeUndefined()
  })

  it('deleting a sub-category keeps the parent on books', async () => {
    const cat = await addCategory('Horror')
    const sub = await addCategory('Gothic', cat.id)
    const b = await createBook({ title: 'Dracula', categoryId: cat.id, subCategoryId: sub.id })
    await deleteCategory(sub.id)
    expect(await db.books.get(b.id)).toMatchObject({ categoryId: cat.id })
    expect((await db.books.get(b.id))?.subCategoryId).toBeUndefined()
  })

  it('deleting a shelf strips it from books', async () => {
    const shelf = (await db.shelves.toArray())[0]
    const b = await createBook({ title: 'A', shelfIds: [shelf.id] })
    expect(await deleteShelf(shelf.id)).toBe(1)
    expect((await db.books.get(b.id))?.shelfIds).toEqual([])
  })
})
