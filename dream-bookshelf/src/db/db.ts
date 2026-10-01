import Dexie, { type EntityTable, type Transaction } from 'dexie'
import type { Book, Category, Cover, Series, Shelf, SyncTask } from './types'
import { uid } from '../lib/utils'

export const DB_NAME = 'dream-bookshelf'

export class BookshelfDB extends Dexie {
  books!: EntityTable<Book, 'id'>
  series!: EntityTable<Series, 'id'>
  categories!: EntityTable<Category, 'id'>
  shelves!: EntityTable<Shelf, 'id'>
  covers!: EntityTable<Cover, 'id'>
  syncQueue!: EntityTable<SyncTask, 'id'>

  constructor(name = DB_NAME) {
    super(name)

    // Index plan:
    //  - `*field` = multiEntry index, so "books on shelf X" / "books by author Y" are index lookups.
    //  - Covers live in their own table so listing books never deserialises image blobs.
    this.version(1).stores({
      books:
        'id, title, status, categoryId, subCategoryId, seriesId, *shelfIds, *authors, isbn, metadataState, createdAt, updatedAt',
      series: 'id, title, status, categoryId, *shelfIds, createdAt, updatedAt',
      categories: 'id, parentId, order',
      shelves: 'id, order',
      covers: 'id',
      syncQueue: '++id, type, entityId, nextAttemptAt',
    })

    this.on('populate', (tx) => seedDefaults(tx))
  }
}

/** A gentle starter taxonomy; everything is renameable / deletable in the Categories tab. */
export const DEFAULT_TAXONOMY: Array<{ name: string; children: string[] }> = [
  { name: 'Sci-Fi', children: ['Cyberpunk', 'Space Opera', 'Hard Sci-Fi'] },
  { name: 'Fantasy', children: ['Epic', 'Cozy', 'Romantasy'] },
  { name: 'Dark Academia', children: [] },
  { name: 'Literary Fiction', children: ['Classics', 'Contemporary'] },
  { name: 'Mystery & Thriller', children: [] },
  { name: 'Philosophy', children: ['Stoicism', 'Existentialism'] },
  { name: 'Non-Fiction', children: ['History', 'Science', 'Memoir'] },
]

export const DEFAULT_SHELVES = ['Top Priority', 'Fall Reads', 'Signed Editions']

export function buildDefaultTaxonomy(now = Date.now()) {
  const categories: Category[] = []
  DEFAULT_TAXONOMY.forEach((cat, i) => {
    const parentId = uid()
    categories.push({ id: parentId, name: cat.name, parentId: null, order: i, createdAt: now, updatedAt: now })
    cat.children.forEach((child, j) => {
      categories.push({ id: uid(), name: child, parentId, order: j, createdAt: now, updatedAt: now })
    })
  })
  const shelves: Shelf[] = DEFAULT_SHELVES.map((name, i) => ({
    id: uid(),
    name,
    order: i,
    createdAt: now,
    updatedAt: now,
  }))
  return { categories, shelves }
}

function seedDefaults(tx: Transaction) {
  const { categories, shelves } = buildDefaultTaxonomy()
  tx.table('categories').bulkAdd(categories)
  tx.table('shelves').bulkAdd(shelves)
}

export const db = new BookshelfDB()
