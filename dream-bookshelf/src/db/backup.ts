import { liveQuery } from 'dexie'
import { db } from './db'
import type { Book, Category, Cover, Series, Shelf } from './types'
import { BOOK_STATUSES, SERIES_STATUSES } from './types'
import { debounce } from '../lib/utils'
import { enqueueTask, requestSync } from '../sync/enqueue'
import { getSettings, type Settings } from '../store/settings'

export const BACKUP_FORMAT = 'dream-bookshelf-backup'
export const BACKUP_VERSION = 1

export interface BackupCover {
  id: string
  type: string
  origin: Cover['origin']
  sourceUrl?: string
  createdAt: number
  /** base64-encoded image bytes */
  data: string
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT
  version: number
  exportedAt: string
  books: Book[]
  series: Series[]
  categories: Category[]
  shelves: Shelf[]
  covers?: BackupCover[]
  settings?: Partial<Settings>
}

export class BackupError extends Error {}

/* ------------------------------------------------------------------------------------------
 * base64 <-> Blob (works in browsers and Node, no FileReader needed)
 * ---------------------------------------------------------------------------------------- */

export async function blobToBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return btoa(binary)
}

export function base64ToBlob(data: string, type: string): Blob {
  const binary = atob(data)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type })
}

/* ------------------------------------------------------------------------------------------
 * Export
 * ---------------------------------------------------------------------------------------- */

export async function buildBackup({ includeCovers }: { includeCovers: boolean }): Promise<BackupFile> {
  const [books, series, categories, shelves] = await Promise.all([
    db.books.toArray(),
    db.series.toArray(),
    db.categories.toArray(),
    db.shelves.toArray(),
  ])
  const backup: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    books,
    series,
    categories,
    shelves,
  }
  const { googleApiKey: _secret, ...settings } = getSettings() as Settings & Record<string, unknown>
  backup.settings = stripFunctions(settings)
  if (includeCovers) {
    const covers = await db.covers.toArray()
    backup.covers = await Promise.all(
      covers.map(async (c) => ({
        id: c.id,
        type: c.type,
        origin: c.origin,
        sourceUrl: c.sourceUrl,
        createdAt: c.createdAt,
        data: await blobToBase64(c.blob),
      })),
    )
  }
  return backup
}

function stripFunctions<T extends Record<string, unknown>>(obj: T): Partial<Settings> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => typeof v !== 'function')) as Partial<Settings>
}

export function backupFileName(date = new Date()) {
  const stamp = date.toISOString().slice(0, 10)
  return `dream-bookshelf-${stamp}.json`
}

/* ------------------------------------------------------------------------------------------
 * Import
 * ---------------------------------------------------------------------------------------- */

const isStr = (v: unknown): v is string => typeof v === 'string'
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const strArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter(isStr) : [])

function coerceBook(raw: unknown): Book | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isStr(r.id) || !isStr(r.title)) return null
  const now = Date.now()
  return {
    ...(r as unknown as Book),
    authors: strArray(r.authors),
    shelfIds: strArray(r.shelfIds),
    status: (BOOK_STATUSES as readonly string[]).includes(r.status as string)
      ? (r.status as Book['status'])
      : 'want-to-read',
    source: r.source === 'openlibrary' || r.source === 'google' ? r.source : 'manual',
    metadataState: r.metadataState === 'pending' || r.metadataState === 'failed' ? r.metadataState : 'complete',
    createdAt: isNum(r.createdAt) ? r.createdAt : now,
    updatedAt: isNum(r.updatedAt) ? r.updatedAt : now,
  }
}

function coerceSeries(raw: unknown): Series | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isStr(r.id) || !isStr(r.title)) return null
  const now = Date.now()
  return {
    ...(r as unknown as Series),
    authors: strArray(r.authors),
    shelfIds: strArray(r.shelfIds),
    status: (SERIES_STATUSES as readonly string[]).includes(r.status as string)
      ? (r.status as Series['status'])
      : 'want-to-read',
    createdAt: isNum(r.createdAt) ? r.createdAt : now,
    updatedAt: isNum(r.updatedAt) ? r.updatedAt : now,
  }
}

function coerceCategory(raw: unknown): Category | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isStr(r.id) || !isStr(r.name)) return null
  const now = Date.now()
  return {
    id: r.id,
    name: r.name,
    parentId: isStr(r.parentId) ? r.parentId : null,
    order: isNum(r.order) ? r.order : 0,
    createdAt: isNum(r.createdAt) ? r.createdAt : now,
    updatedAt: isNum(r.updatedAt) ? r.updatedAt : now,
  }
}

function coerceShelf(raw: unknown): Shelf | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (!isStr(r.id) || !isStr(r.name)) return null
  const now = Date.now()
  return {
    id: r.id,
    name: r.name,
    order: isNum(r.order) ? r.order : 0,
    createdAt: isNum(r.createdAt) ? r.createdAt : now,
    updatedAt: isNum(r.updatedAt) ? r.updatedAt : now,
  }
}

function compact<T>(items: unknown, coerce: (raw: unknown) => T | null): { items: T[]; skipped: number } {
  if (!Array.isArray(items)) return { items: [], skipped: 0 }
  const out: T[] = []
  let skipped = 0
  for (const raw of items) {
    const v = coerce(raw)
    if (v) out.push(v)
    else skipped++
  }
  return { items: out, skipped }
}

export interface ParsedBackup {
  backup: BackupFile
  skipped: number
}

/** Parses and validates a backup file; throws `BackupError` with a human message. */
export function parseBackup(text: string): ParsedBackup {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    throw new BackupError("That file isn't valid JSON.")
  }
  if (!json || typeof json !== 'object') throw new BackupError("That file isn't a Dream Bookshelf backup.")
  const r = json as Record<string, unknown>
  if (r.format !== BACKUP_FORMAT) throw new BackupError("That file isn't a Dream Bookshelf backup.")
  if (!isNum(r.version) || r.version > BACKUP_VERSION) {
    throw new BackupError('This backup was made by a newer version of the app. Please update first.')
  }
  const books = compact(r.books, coerceBook)
  const series = compact(r.series, coerceSeries)
  const categories = compact(r.categories, coerceCategory)
  const shelves = compact(r.shelves, coerceShelf)
  const covers = Array.isArray(r.covers)
    ? (r.covers as unknown[]).filter(
        (c): c is BackupCover =>
          !!c && typeof c === 'object' && isStr((c as BackupCover).id) && isStr((c as BackupCover).data),
      )
    : undefined
  return {
    backup: {
      format: BACKUP_FORMAT,
      version: r.version,
      exportedAt: isStr(r.exportedAt) ? r.exportedAt : new Date().toISOString(),
      books: books.items,
      series: series.items,
      categories: categories.items,
      shelves: shelves.items,
      covers,
      settings: r.settings && typeof r.settings === 'object' ? (r.settings as Partial<Settings>) : undefined,
    },
    skipped: books.skipped + series.skipped + categories.skipped + shelves.skipped,
  }
}

export interface ImportSummary {
  added: number
  updated: number
  unchanged: number
}

type Timestamped = { id: string; updatedAt: number }

/** Picks the incoming records that are new or newer than what we have. */
function planMerge<T extends Timestamped>(existing: (T | undefined)[], incoming: T[], summary: ImportSummary): T[] {
  const toPut: T[] = []
  incoming.forEach((item, i) => {
    const current = existing[i]
    if (!current) {
      summary.added++
      toPut.push(item)
    } else if (item.updatedAt > current.updatedAt) {
      summary.updated++
      toPut.push(item)
    } else {
      summary.unchanged++
    }
  })
  return toPut
}

/**
 * - `merge`: keeps local data; incoming records win only when they are newer (by `updatedAt`).
 * - `replace`: wipes the library first, then restores the backup exactly.
 */
export async function importBackup(backup: BackupFile, mode: 'merge' | 'replace'): Promise<ImportSummary> {
  const summary: ImportSummary = { added: 0, updated: 0, unchanged: 0 }
  const covers: Cover[] = (backup.covers ?? []).map((c) => ({
    id: c.id,
    type: c.type || 'image/jpeg',
    origin: c.origin === 'remote' ? 'remote' : 'upload',
    sourceUrl: c.sourceUrl,
    createdAt: c.createdAt || Date.now(),
    blob: base64ToBlob(c.data, c.type || 'image/jpeg'),
  }))
  const coverIds = new Set(covers.map((c) => c.id))

  // Drop references to covers that aren't in this file (exported without covers): the remote
  // URL (if any) still shows, and the sync queue re-downloads it.
  const fixCoverRef = <T extends { coverId?: string }>(e: T): T => {
    if (!e.coverId || coverIds.has(e.coverId)) return e
    const copy = { ...e }
    delete copy.coverId
    return copy
  }
  const books = backup.books.map(fixCoverRef)
  const series = backup.series.map(fixCoverRef)

  await db.transaction('rw', [db.books, db.series, db.categories, db.shelves, db.covers, db.syncQueue], async () => {
    if (mode === 'replace') {
      await Promise.all([
        db.books.clear(),
        db.series.clear(),
        db.categories.clear(),
        db.shelves.clear(),
        db.covers.clear(),
        db.syncQueue.clear(),
      ])
    }
    const existingCovers = new Set(await db.covers.toCollection().primaryKeys())
    await db.covers.bulkPut(covers.filter((c) => !existingCovers.has(c.id)))
    const ids = <T extends Timestamped>(items: T[]) => items.map((i) => i.id)
    await db.categories.bulkPut(
      planMerge(await db.categories.bulkGet(ids(backup.categories)), backup.categories, summary),
    )
    await db.shelves.bulkPut(planMerge(await db.shelves.bulkGet(ids(backup.shelves)), backup.shelves, summary))
    await db.series.bulkPut(planMerge(await db.series.bulkGet(ids(series)), series, summary))
    await db.books.bulkPut(planMerge(await db.books.bulkGet(ids(books)), books, summary))

    if (getSettings().cacheCovers) {
      for (const b of books) {
        if (b.coverUrl && !b.coverId) await enqueueTask('cache-cover', b.id)
      }
    }
  })
  requestSync()
  return summary
}

/* ------------------------------------------------------------------------------------------
 * Auto-persisted localStorage snapshot
 *
 * IndexedDB is the source of truth. As a safety net we mirror the library (without cover
 * images, to stay within the ~5 MB localStorage quota) into localStorage. If IndexedDB ever
 * comes back empty while the snapshot has data, the app offers a one-tap restore.
 * ---------------------------------------------------------------------------------------- */

export const SNAPSHOT_KEY = 'dream-bookshelf:snapshot'

export interface LocalSnapshot {
  savedAt: number
  backup: BackupFile
}

export const snapshotStatus = { lastSavedAt: 0, lastError: '' }

export function readLocalSnapshot(): LocalSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LocalSnapshot
    if (!parsed?.backup || parsed.backup.format !== BACKUP_FORMAT) return null
    return parsed
  } catch {
    return null
  }
}

export function clearLocalSnapshot() {
  try {
    localStorage.removeItem(SNAPSHOT_KEY)
  } catch {
    /* ignore */
  }
}

export function writeLocalSnapshot(backup: BackupFile) {
  try {
    const snapshot: LocalSnapshot = { savedAt: Date.now(), backup }
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
    snapshotStatus.lastSavedAt = snapshot.savedAt
    snapshotStatus.lastError = ''
  } catch (err) {
    snapshotStatus.lastError =
      err instanceof DOMException && err.name === 'QuotaExceededError'
        ? 'Library is too large for the localStorage safety copy — use JSON export instead.'
        : 'Could not write the localStorage safety copy.'
  }
}

/**
 * Starts mirroring the library into localStorage (debounced). An empty library is only
 * mirrored if this session has seen data before — so an evicted/blank IndexedDB at startup
 * never overwrites a good snapshot.
 */
export function startAutoSnapshot(delayMs = 1500): () => void {
  let sessionHadData = false
  const save = debounce((data: [Book[], Series[], Category[], Shelf[]]) => {
    const [books, series, categories, shelves] = data
    const hasData = books.length + series.length > 0
    if (!hasData && !sessionHadData) return
    if (hasData) sessionHadData = true
    writeLocalSnapshot({
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      books,
      series,
      categories,
      shelves,
    })
  }, delayMs)

  const sub = liveQuery(() =>
    Promise.all([db.books.toArray(), db.series.toArray(), db.categories.toArray(), db.shelves.toArray()]),
  ).subscribe({ next: save, error: () => {} })

  return () => {
    save.cancel()
    sub.unsubscribe()
  }
}
