/**
 * Offline-first background work queue (persisted in IndexedDB).
 *
 * iOS Safari has no Background Sync API, so instead of relying on the service worker we
 * process the queue from the page whenever it is likely to succeed: on launch, when the
 * device comes back online, when the app returns to the foreground, on pull-to-refresh,
 * and on a slow interval. Tasks retry with exponential backoff and park after MAX_ATTEMPTS.
 */
import { db } from '../db/db'
import type { Book, SyncTask } from '../db/types'
import { candidateToBookPatch, findBestMatch, LookupsDisabledError } from '../api/metadata'
import { fetchBlob, HttpError, isOnline, OfflineError } from '../api/http'
import { compressImage, looksLikeRealCover } from '../lib/image'
import { getSettings } from '../store/settings'
import { enqueueTask, SYNC_EVENT } from './enqueue'
import { setLocalCover, updateBook } from '../db/repo'

export const MAX_ATTEMPTS = 6
/** `nextAttemptAt` value for tasks that gave up; they wait for a manual retry in Settings. */
export const PARKED = Number.MAX_SAFE_INTEGER

export interface SyncResult {
  processed: number
  updated: number
  failed: number
  remaining: number
  skipped?: 'offline' | 'disabled' | 'busy'
}

type Listener = (state: { running: boolean; last?: SyncResult }) => void
const listeners = new Set<Listener>()
let running: Promise<SyncResult> | null = null
let lastResult: SyncResult | undefined

export function onSyncState(fn: Listener) {
  listeners.add(fn)
  fn({ running: !!running, last: lastResult })
  return () => {
    listeners.delete(fn)
  }
}
const emit = () => listeners.forEach((fn) => fn({ running: !!running, last: lastResult }))

export function backoffMs(attempts: number): number {
  // 30s, 1m, 2m, 4m, 8m ... capped at 6h
  return Math.min(30_000 * 2 ** Math.max(0, attempts - 1), 6 * 60 * 60 * 1000)
}

/** Is this failure worth retrying later (network blips, rate limits) or permanent? */
function isTransient(err: unknown): boolean {
  if (err instanceof OfflineError) return true
  if (err instanceof HttpError) return err.status === 429 || err.status >= 500 || err.status === 403
  return true // network errors, timeouts
}

async function runEnrich(task: SyncTask): Promise<boolean> {
  const book = await db.books.get(task.entityId)
  if (!book) return false
  const match = await findBestMatch(book)
  if (!match) {
    await db.books.update(book.id, { metadataState: 'failed', updatedAt: Date.now() })
    return false
  }
  const patch = candidateToBookPatch(book, match)
  await updateBook(book.id, { ...patch, metadataState: 'complete' })
  // The remote cover (if any) gets its own task so a slow image never blocks metadata.
  if ((patch.coverUrl || book.coverUrl) && !book.coverId && getSettings().cacheCovers) {
    await enqueueTask('cache-cover', book.id)
  }
  return Object.keys(patch).length > 0
}

async function runCacheCover(task: SyncTask): Promise<boolean> {
  const book: Book | undefined = await db.books.get(task.entityId)
  if (!book?.coverUrl || book.coverId) return false
  let blob: Blob
  try {
    blob = await fetchBlob(book.coverUrl)
  } catch (err) {
    // A TypeError here is almost always CORS: the host won't let us read the bytes. The
    // <img> tag still works (and the service worker caches it), so give up quietly.
    if (err instanceof TypeError && isOnline()) return false
    throw err
  }
  if (!looksLikeRealCover(blob)) {
    await updateBook(book.id, { coverUrl: undefined })
    return true
  }
  const compressed = await compressImage(blob, { maxWidth: 480, maxHeight: 720 })
  await setLocalCover({ kind: 'book', id: book.id }, compressed, 'remote', book.coverUrl)
  return true
}

const handlers: Record<SyncTask['type'], (t: SyncTask) => Promise<boolean>> = {
  'enrich-book': runEnrich,
  'cache-cover': runCacheCover,
}

/** Processes due tasks. `force` ignores backoff timers (pull-to-refresh / "Retry now"). */
export function processQueue({ force = false }: { force?: boolean } = {}): Promise<SyncResult> {
  if (running) return running
  // `running` is cleared before callers' awaits resume, so back-to-back calls each do work.
  const job = runQueue(force)
    .then((r) => {
      lastResult = r
      return r
    })
    .finally(() => {
      running = null
      emit()
    })
  running = job
  emit()
  return job
}

async function runQueue(force: boolean): Promise<SyncResult> {
  const result: SyncResult = { processed: 0, updated: 0, failed: 0, remaining: 0 }
  const settings = getSettings()
  if (!settings.onlineLookups) result.skipped = 'disabled'
  else if (!isOnline()) result.skipped = 'offline'

  if (!result.skipped) {
    const due = force
      ? await db.syncQueue.where('nextAttemptAt').below(PARKED).toArray()
      : await db.syncQueue.where('nextAttemptAt').belowOrEqual(Date.now()).toArray()
    // Metadata first (it may discover covers), oldest first.
    due.sort((a, b) => (a.type === b.type ? a.createdAt - b.createdAt : a.type === 'enrich-book' ? -1 : 1))

    for (const task of due) {
      if (!isOnline()) break
      result.processed++
      try {
        const changed = await handlers[task.type](task)
        if (changed) result.updated++
        await db.syncQueue.delete(task.id!)
      } catch (err) {
        if (err instanceof LookupsDisabledError) break
        const attempts = task.attempts + 1
        const parked = attempts >= MAX_ATTEMPTS || !isTransient(err)
        await db.syncQueue.update(task.id!, {
          attempts,
          nextAttemptAt: parked ? PARKED : Date.now() + backoffMs(attempts),
          lastError: err instanceof Error ? err.message : String(err),
        })
        if (parked) {
          result.failed++
          if (task.type === 'enrich-book') await db.books.update(task.entityId, { metadataState: 'failed' })
        }
      }
    }
  }
  result.remaining = await db.syncQueue.where('nextAttemptAt').below(PARKED).count()
  return result
}

/** Re-queue every book that still lacks metadata or a local cover (pull-to-refresh). */
export async function queueMissingMetadata(): Promise<number> {
  const settings = getSettings()
  const books = await db.books.toArray()
  let queued = 0
  await db.transaction('rw', db.syncQueue, async () => {
    for (const b of books) {
      if (b.metadataState === 'pending') {
        await enqueueTask('enrich-book', b.id)
        queued++
      } else if (settings.cacheCovers && b.coverUrl && !b.coverId) {
        await enqueueTask('cache-cover', b.id)
        queued++
      }
    }
  })
  return queued
}

/** Retry tasks that exhausted their attempts (Settings → Sync). */
export async function retryParkedTasks() {
  await db.syncQueue.where('nextAttemptAt').aboveOrEqual(PARKED).modify({
    attempts: 0,
    nextAttemptAt: Date.now(),
  })
  return processQueue({ force: true })
}

export async function clearParkedTasks() {
  return db.syncQueue.where('nextAttemptAt').aboveOrEqual(PARKED).delete()
}

/** Wires the queue to connectivity / visibility events. Returns a cleanup function. */
export function startSyncEngine(): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  const soon = (delay = 400) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void processQueue(), delay)
  }
  const onVisible = () => document.visibilityState === 'visible' && soon(800)
  const onOnline = () => soon(1200)
  const onRequest = () => soon(300)

  window.addEventListener('online', onOnline)
  window.addEventListener(SYNC_EVENT, onRequest)
  document.addEventListener('visibilitychange', onVisible)
  const interval = setInterval(() => document.visibilityState === 'visible' && void processQueue(), 120_000)
  soon(1500)

  return () => {
    if (timer) clearTimeout(timer)
    clearInterval(interval)
    window.removeEventListener('online', onOnline)
    window.removeEventListener(SYNC_EVENT, onRequest)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
