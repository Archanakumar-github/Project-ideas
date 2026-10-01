/**
 * User-facing actions = repository writes + friendly feedback (toasts, undo). Components call
 * these instead of the repo directly so behaviour is consistent everywhere.
 */
import type { BookCandidate } from '../api/types'
import { candidateToDraft } from '../api/metadata'
import {
  createBook,
  deleteBooks,
  deleteSeries,
  findOrCreateSeries,
  nextSeriesIndex,
  restoreSnapshot,
} from '../db/repo'
import type { Book, BookStatus, SeriesStatus } from '../db/types'
import { enqueueTask } from '../sync/enqueue'
import { processQueue, queueMissingMetadata, type SyncResult } from '../sync/queue'
import { getSettings, useSettings } from '../store/settings'
import { ui, type SeriesTarget } from '../store/ui'
import { BOOK_STATUS_META } from './status'
import { formatIsbn, looksLikeIsbn, toIsbn13 } from './isbn'
import { pluralize } from './utils'
import { isOnline } from '../api/http'

export function seriesStatusFor(status: BookStatus): SeriesStatus {
  return status === 'owned' ? 'collecting' : status
}

export interface SaveOptions {
  status: BookStatus
  categoryId?: string
  subCategoryId?: string
  shelfIds?: string[]
  /** Create/attach the series the provider reported. */
  attachSeries?: boolean
  target?: SeriesTarget
}

function remember(opts: SaveOptions) {
  useSettings.getState().set({
    lastStatus: opts.status,
    lastCategoryId: opts.categoryId,
    lastSubCategoryId: opts.subCategoryId,
  })
}

async function resolveSeries(
  c: Pick<BookCandidate, 'seriesName' | 'seriesIndex' | 'authors'>,
  opts: SaveOptions,
): Promise<{ seriesId?: string; seriesIndex?: number; createdSeriesId?: string }> {
  let seriesId = opts.target?.seriesId
  let seriesIndex = opts.target?.seriesIndex ?? c.seriesIndex
  let createdSeriesId: string | undefined
  if (!seriesId && opts.attachSeries && c.seriesName) {
    const before = Date.now()
    const s = await findOrCreateSeries(c.seriesName, c.authors, seriesStatusFor(opts.status))
    seriesId = s.id
    if (s.createdAt >= before) createdSeriesId = s.id
  }
  if (seriesId && seriesIndex === undefined) seriesIndex = await nextSeriesIndex(seriesId)
  return { seriesId, seriesIndex: seriesId ? seriesIndex : undefined, createdSeriesId }
}

/** One-tap save of an online search result. */
export async function saveCandidate(c: BookCandidate, opts: SaveOptions): Promise<Book> {
  const { seriesId, seriesIndex, createdSeriesId } = await resolveSeries(c, opts)
  const book = await createBook({
    ...candidateToDraft(c),
    status: opts.status,
    categoryId: opts.categoryId,
    subCategoryId: opts.subCategoryId,
    shelfIds: opts.shelfIds ?? [],
    seriesId,
    seriesIndex,
  })
  remember(opts)
  ui.toast({
    message: `Added “${book.title}” to ${BOOK_STATUS_META[opts.status].label}`,
    tone: 'success',
    action: {
      label: 'Undo',
      run: () => {
        void deleteBooks([book.id])
        if (createdSeriesId) void deleteSeries(createdSeriesId, false)
      },
    },
  })
  return book
}

export const PLACEHOLDER_PREFIX = 'ISBN '

/** Offline (or no results): save what was typed; the sync queue fills in the rest later. */
export async function savePlaceholder(query: string, opts: SaveOptions): Promise<Book> {
  const isbn = looksLikeIsbn(query) ? toIsbn13(query) : undefined
  const { seriesId, seriesIndex } = await resolveSeries({ authors: [] }, opts)
  const book = await createBook(
    {
      title: isbn ? `${PLACEHOLDER_PREFIX}${formatIsbn(isbn)}` : query.trim(),
      isbn,
      status: opts.status,
      categoryId: opts.categoryId,
      subCategoryId: opts.subCategoryId,
      shelfIds: opts.shelfIds ?? [],
      seriesId,
      seriesIndex,
    },
    { enrich: true },
  )
  remember(opts)
  ui.toast({
    message: isOnline()
      ? `Saved “${book.title}” — looking up details…`
      : `Saved “${book.title}”. Details & cover will load when you're back online.`,
    tone: 'success',
    action: { label: 'Undo', run: () => void deleteBooks([book.id]) },
  })
  return book
}

export async function deleteBooksWithUndo(ids: string[]) {
  if (!ids.length) return
  const snapshot = await deleteBooks(ids)
  const label = snapshot.books.length === 1 ? `“${snapshot.books[0].title}”` : pluralize(snapshot.books.length, 'book')
  ui.toast({ message: `Deleted ${label}`, action: { label: 'Undo', run: () => void restoreSnapshot(snapshot) } })
}

export async function deleteSeriesWithUndo(id: string, withVolumes: boolean) {
  const snapshot = await deleteSeries(id, withVolumes)
  const title = snapshot.series[0]?.title ?? 'series'
  ui.toast({
    message: withVolumes ? `Deleted “${title}” and ${pluralize(snapshot.books.length, 'book')}` : `Deleted series “${title}”`,
    action: { label: 'Undo', run: () => void restoreSnapshot(snapshot) },
  })
}

function describeSync(r: SyncResult): { message: string; tone: 'success' | 'warning' | 'default' } {
  if (r.skipped === 'offline') return { message: "You're offline — updates will run when you reconnect.", tone: 'warning' }
  if (r.skipped === 'disabled') return { message: 'Online lookups are turned off in Settings.', tone: 'warning' }
  if (r.updated > 0) return { message: `Updated ${pluralize(r.updated, 'book')}`, tone: 'success' }
  if (r.remaining > 0) return { message: `${pluralize(r.remaining, 'update')} still waiting — will retry soon.`, tone: 'default' }
  return { message: 'Everything is up to date', tone: 'success' }
}

/** Pull-to-refresh: re-queue anything incomplete and run the queue right now. */
export async function refreshLibrary(): Promise<void> {
  await queueMissingMetadata()
  const result = await processQueue({ force: true })
  ui.toast(describeSync(result))
}

/** "Refresh details" on a single book. */
export async function refreshBook(book: Book): Promise<void> {
  if (!getSettings().onlineLookups) {
    ui.toast({ message: 'Online lookups are turned off in Settings.', tone: 'warning' })
    return
  }
  await enqueueTask('enrich-book', book.id)
  const result = await processQueue({ force: true })
  ui.toast(describeSync(result))
}
