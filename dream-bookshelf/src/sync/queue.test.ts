import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../db/db'
import { createBook } from '../db/repo'
import { MAX_ATTEMPTS, PARKED, backoffMs, processQueue, retryParkedTasks } from './queue'
import { useSettings } from '../store/settings'
import { olLeviathan } from '../test/fixtures/openLibrary'

const fetchMock = vi.fn<typeof fetch>()

beforeEach(async () => {
  await db.delete()
  await db.open()
  vi.stubGlobal('fetch', fetchMock)
  useSettings.setState({ onlineLookups: true, googleFallback: false, cacheCovers: false })
})
afterEach(() => {
  fetchMock.mockReset()
  vi.unstubAllGlobals()
})

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

describe('sync queue', () => {
  it('backs off exponentially with a cap', () => {
    expect(backoffMs(1)).toBe(30_000)
    expect(backoffMs(2)).toBe(60_000)
    expect(backoffMs(50)).toBe(6 * 60 * 60 * 1000)
  })

  it('fills in missing metadata for books added offline', async () => {
    fetchMock.mockResolvedValue(json(olLeviathan))
    const book = await createBook({ title: 'leviathan wakes', authors: ['Corey'], notes: 'from the shop' }, { enrich: true })
    const result = await processQueue()
    expect(result).toMatchObject({ processed: 1, updated: 1, remaining: 0 })
    const after = await db.books.get(book.id)
    expect(after).toMatchObject({
      title: 'leviathan wakes', // user's text is kept
      notes: 'from the shop',
      publishYear: 2011,
      metadataState: 'complete',
      source: 'openlibrary',
    })
    expect(after?.coverUrl).toContain('6655616')
  })

  it('marks books it cannot match as failed', async () => {
    fetchMock.mockResolvedValue(json({ numFound: 0, docs: [] }))
    const book = await createBook({ title: 'zzzz unknown' }, { enrich: true })
    await processQueue()
    expect((await db.books.get(book.id))?.metadataState).toBe('failed')
    expect(await db.syncQueue.count()).toBe(0)
  })

  it('retries transient errors with backoff, then parks the task', async () => {
    fetchMock.mockResolvedValue(json({}, 503))
    const book = await createBook({ title: 'Dune' }, { enrich: true })
    await processQueue()
    let task = (await db.syncQueue.toArray())[0]
    expect(task.attempts).toBe(1)
    expect(task.nextAttemptAt).toBeGreaterThan(Date.now())

    // Not due yet -> skipped unless forced.
    expect((await processQueue()).processed).toBe(0)
    for (let i = 1; i < MAX_ATTEMPTS; i++) await processQueue({ force: true })
    task = (await db.syncQueue.toArray())[0]
    expect(task.nextAttemptAt).toBe(PARKED)
    expect((await db.books.get(book.id))?.metadataState).toBe('failed')

    fetchMock.mockResolvedValue(json(olLeviathan))
    await db.books.update(book.id, { title: 'Leviathan Wakes' })
    const retried = await retryParkedTasks()
    expect(retried.updated).toBe(1)
  })

  it('does nothing when lookups are disabled', async () => {
    useSettings.setState({ onlineLookups: false })
    await createBook({ title: 'Dune' }, { enrich: false })
    await db.syncQueue.add({ type: 'enrich-book', entityId: 'x', attempts: 0, nextAttemptAt: 0, createdAt: 0 })
    expect((await processQueue()).skipped).toBe('disabled')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
