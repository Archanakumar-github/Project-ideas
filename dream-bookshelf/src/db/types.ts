export const BOOK_STATUSES = ['want-to-read', 'want-to-buy', 'owned'] as const
export type BookStatus = (typeof BOOK_STATUSES)[number]

export const SERIES_STATUSES = ['want-to-read', 'want-to-buy', 'collecting', 'complete'] as const
export type SeriesStatus = (typeof SERIES_STATUSES)[number]

export type MetadataSource = 'openlibrary' | 'google' | 'manual'

/**
 * - `complete`: metadata is as good as it will get.
 * - `pending`: saved offline (or without a match); the sync queue will try to fill gaps.
 * - `failed`: the queue looked but could not find a confident match.
 */
export type MetadataState = 'complete' | 'pending' | 'failed'

export interface Book {
  id: string
  title: string
  subtitle?: string
  authors: string[]
  publishYear?: number
  pageCount?: number
  /** ISBN-13 when known (ISBN-10s are upgraded on save). */
  isbn?: string
  description?: string
  price?: number
  currency?: string
  /** Where to buy / learn more. */
  link?: string
  status: BookStatus
  categoryId?: string
  subCategoryId?: string
  /** Custom shelves = user-managed quick-filter tags ("Top Priority", "Fall Reads"...). */
  shelfIds: string[]
  notes?: string
  /** Remote cover; shown via the service-worker image cache until a local copy exists. */
  coverUrl?: string
  /** Local cover blob in the `covers` table (uploaded, or downloaded for offline use). */
  coverId?: string
  seriesId?: string
  /** Position within the series; decimals allowed for novellas (e.g. 2.5). */
  seriesIndex?: number
  source: MetadataSource
  sourceId?: string
  metadataState: MetadataState
  createdAt: number
  updatedAt: number
}

export interface Series {
  id: string
  title: string
  authors: string[]
  status: SeriesStatus
  /** Planned/known number of volumes; lets us show gaps ("Book #4 — not added yet"). */
  totalVolumes?: number
  description?: string
  categoryId?: string
  subCategoryId?: string
  shelfIds: string[]
  notes?: string
  coverId?: string
  createdAt: number
  updatedAt: number
}

/** Two-level taxonomy: `parentId === null` is a main category/genre, otherwise a sub-category. */
export interface Category {
  id: string
  name: string
  parentId: string | null
  order: number
  createdAt: number
  updatedAt: number
}

export interface Shelf {
  id: string
  name: string
  order: number
  createdAt: number
  updatedAt: number
}

export interface Cover {
  id: string
  blob: Blob
  type: string
  origin: 'upload' | 'remote'
  sourceUrl?: string
  createdAt: number
}

export type SyncTaskType = 'enrich-book' | 'cache-cover'

export interface SyncTask {
  id?: number
  type: SyncTaskType
  entityId: string
  attempts: number
  /** Epoch ms; `Number.MAX_SAFE_INTEGER` parks a task that exhausted its retries (see Settings). */
  nextAttemptAt: number
  lastError?: string
  createdAt: number
}

/** Fields a user (or the metadata fetcher) supplies when creating a book. */
export type BookDraft = Partial<Omit<Book, 'id' | 'createdAt' | 'updatedAt'>> & {
  title: string
}

export type SeriesDraft = Partial<Omit<Series, 'id' | 'createdAt' | 'updatedAt'>> & {
  title: string
}
