import { db } from '../db/db'
import type { SyncTaskType } from '../db/types'

export const SYNC_EVENT = 'bookshelf:sync-requested'

/**
 * Adds (or revives) a background task. Safe to call inside a Dexie transaction that
 * includes the `syncQueue` table.
 */
export async function enqueueTask(type: SyncTaskType, entityId: string, delayMs = 0) {
  const now = Date.now()
  const existing = await db.syncQueue
    .where('entityId')
    .equals(entityId)
    .filter((t) => t.type === type)
    .first()
  if (existing?.id !== undefined) {
    await db.syncQueue.update(existing.id, { attempts: 0, nextAttemptAt: now + delayMs, lastError: undefined })
    return
  }
  await db.syncQueue.add({ type, entityId, attempts: 0, nextAttemptAt: now + delayMs, createdAt: now })
}

/** Nudges the sync engine (if running) to process the queue soon. */
export function requestSync() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(SYNC_EVENT))
}
