import { beforeEach, describe, expect, it } from 'vitest'
import { db } from './db'
import { createBook, createSeries } from './repo'
import {
  BackupError,
  base64ToBlob,
  blobToBase64,
  buildBackup,
  importBackup,
  parseBackup,
  readLocalSnapshot,
  writeLocalSnapshot,
} from './backup'
import { useSettings } from '../store/settings'

beforeEach(async () => {
  await db.delete()
  await db.open()
  localStorage.clear()
  useSettings.setState({ cacheCovers: false, googleApiKey: 'secret-key' })
})

describe('base64', () => {
  it('round-trips binary data', async () => {
    const bytes = new Uint8Array(70_000).map((_, i) => i % 256)
    const b64 = await blobToBase64(new Blob([bytes]))
    const back = new Uint8Array(await base64ToBlob(b64, 'image/png').arrayBuffer())
    expect(back).toEqual(bytes)
  })
})

describe('export / import', () => {
  it('round-trips a library including covers, without leaking the API key', async () => {
    const s = await createSeries({ title: 'The Expanse' })
    await createBook({ title: 'Leviathan Wakes', seriesId: s.id, seriesIndex: 1 }, { coverBlob: new Blob(['jpg'], { type: 'image/jpeg' }) })
    const backup = await buildBackup({ includeCovers: true })
    const text = JSON.stringify(backup)
    expect(text).not.toContain('secret-key')

    await db.delete()
    await db.open()
    const { backup: parsed, skipped } = parseBackup(text)
    expect(skipped).toBe(0)
    const summary = await importBackup(parsed, 'replace')
    expect(summary.added).toBeGreaterThan(2)
    const book = (await db.books.toArray())[0]
    expect(book.title).toBe('Leviathan Wakes')
    const cover = await db.covers.get(book.coverId!)
    expect(await cover!.blob.text()).toBe('jpg')
  })

  it('merges by updatedAt and drops dangling cover references', async () => {
    const local = await createBook({ title: 'Local title' })
    const backup = await buildBackup({ includeCovers: false })
    backup.books[0] = { ...backup.books[0], title: 'Older title', updatedAt: local.updatedAt - 1000 }
    backup.books.push({ ...backup.books[0], id: 'new-book', title: 'Imported', coverId: 'missing', updatedAt: Date.now() })

    const summary = await importBackup(backup, 'merge')
    expect((await db.books.get(local.id))?.title).toBe('Local title')
    const imported = await db.books.get('new-book')
    expect(imported?.title).toBe('Imported')
    expect(imported?.coverId).toBeUndefined()
    expect(summary.added).toBe(1)
  })

  it('rejects foreign or future files with friendly errors', () => {
    expect(() => parseBackup('nope')).toThrow(BackupError)
    expect(() => parseBackup('{"hello":1}')).toThrow(/isn't a Bibliotheca backup/)
    expect(() => parseBackup('{"format":"dream-bookshelf-backup","version":99}')).toThrow(/newer version/)
  })

  it('skips malformed records instead of failing the whole import', () => {
    const { backup, skipped } = parseBackup(
      JSON.stringify({
        format: 'dream-bookshelf-backup',
        version: 1,
        books: [{ id: 'ok', title: 'Fine', status: 'weird' }, { title: 'no id' }],
        series: [],
        categories: [],
        shelves: [],
      }),
    )
    expect(skipped).toBe(1)
    expect(backup.books[0]).toMatchObject({ id: 'ok', status: 'want-to-read', authors: [], shelfIds: [] })
  })
})

describe('local snapshot', () => {
  it('writes and reads the safety copy', async () => {
    await createBook({ title: 'Snapshot me' })
    writeLocalSnapshot(await buildBackup({ includeCovers: false }))
    expect(readLocalSnapshot()?.backup.books[0].title).toBe('Snapshot me')
  })
})
