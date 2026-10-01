import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { candidateToBookPatch, dedupeCandidates, findBestMatch, scoreMatch, searchBooks, titleSimilarity } from './metadata'
import { mapOpenLibraryDoc } from './openLibrary'
import { mapGoogleVolume } from './googleBooks'
import { olLeviathan } from '../test/fixtures/openLibrary'
import { gbLeviathan } from '../test/fixtures/googleBooks'
import { useSettings } from '../store/settings'
import type { Book } from '../db/types'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

describe('matching helpers', () => {
  it('scores title similarity', () => {
    expect(titleSimilarity('The Name of the Wind', 'Name of the Wind')).toBe(1)
    expect(titleSimilarity('Dune', 'Dune Messiah')).toBe(0.85)
    expect(titleSimilarity('Dune', 'Project Hail Mary')).toBe(0)
  })

  it('requires an author match for a confident score', () => {
    const c = mapOpenLibraryDoc(olLeviathan.docs[0])
    expect(scoreMatch({ title: 'Leviathan Wakes', authors: ['Corey'] }, c)).toBe(1)
    expect(scoreMatch({ title: 'Leviathan Wakes', authors: ['Someone Else'] }, c)).toBeLessThan(0.8)
    expect(scoreMatch({ title: 'whatever', authors: [], isbn: '9780316129084' }, c)).toBe(1)
  })

  it('dedupes across providers and merges missing fields', () => {
    const ol = mapOpenLibraryDoc(olLeviathan.docs[0])
    const gb = mapGoogleVolume(gbLeviathan.items![0])!
    const [merged, ...rest] = dedupeCandidates([ol, gb])
    expect(rest).toHaveLength(0)
    expect(merged.source).toBe('openlibrary')
    expect(merged.price).toBe(9.99)
    expect(merged.description).toContain('Humanity')
  })

  it('never overwrites user-entered fields', () => {
    const book = {
      id: 'b1', title: 'Leviathan Wakes', authors: ['Me'], status: 'owned', shelfIds: [], source: 'manual',
      metadataState: 'pending', createdAt: 0, updatedAt: 0, pageCount: 100, notes: 'mine',
    } as Book
    const patch = candidateToBookPatch(book, mapOpenLibraryDoc(olLeviathan.docs[0]))
    expect(patch.authors).toBeUndefined()
    expect(patch.pageCount).toBeUndefined()
    expect(patch.publishYear).toBe(2011)
    expect(patch.coverUrl).toContain('6655616')
    expect(patch.source).toBe('openlibrary')
  })
})

describe('searchBooks', () => {
  const fetchMock = vi.fn<typeof fetch>()
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock)
    useSettings.setState({ onlineLookups: true, googleFallback: true, googleApiKey: '' })
  })
  afterEach(() => {
    fetchMock.mockReset()
    vi.unstubAllGlobals()
  })

  it('uses Open Library and tops up thin results from Google Books', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url.startsWith('https://openlibrary.org/search.json')) return jsonResponse(olLeviathan)
      if (url.startsWith('https://www.googleapis.com/books/v1/volumes')) return jsonResponse(gbLeviathan)
      throw new Error(`unexpected ${url}`)
    })
    const out = await searchBooks('leviathan wakes')
    expect(out.sources).toEqual(['openlibrary', 'google'])
    expect(out.results.map((r) => r.key)).toEqual(['openlibrary:/works/OL15833435W', 'openlibrary:/works/OL20030493W'])
    expect(out.results[0].price).toBe(9.99)
  })

  it('degrades gracefully when one provider is rate limited', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url.startsWith('https://openlibrary.org')) return jsonResponse({ error: 'busy' }, 503)
      return jsonResponse(gbLeviathan)
    })
    const out = await searchBooks('leviathan wakes')
    expect(out.sources).toEqual(['google'])
    expect(out.results).toHaveLength(1)
    expect(out.warnings[0]).toMatch(/Open Library/)
  })

  it('throws when every provider fails', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 429))
    await expect(searchBooks('leviathan wakes')).rejects.toThrow(/429/)
  })

  it('folds an ISBN lookup into a single merged result', async () => {
    fetchMock.mockImplementation(async (input) => {
      const url = String(input)
      if (url.includes('openlibrary.org')) return jsonResponse({ numFound: 1, docs: [olLeviathan.docs[0]] })
      return jsonResponse(gbLeviathan)
    })
    const out = await searchBooks('978-0-316-12908-4')
    expect(out.results).toHaveLength(1)
    expect(out.results[0]).toMatchObject({ isbn: '9780316129084', price: 9.99, seriesIndex: 1 })
    expect(String(fetchMock.mock.calls[0][0])).toContain('isbn=9780316129084')
  })

  it('respects the privacy switch', async () => {
    useSettings.setState({ onlineLookups: false })
    await expect(searchBooks('dune')).rejects.toThrow(/turned off/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('finds a confident match for background enrichment', async () => {
    fetchMock.mockImplementation(async () => jsonResponse(olLeviathan))
    useSettings.setState({ googleFallback: false })
    const match = await findBestMatch({ title: 'leviathan wakes', authors: ['James Corey'] })
    expect(match?.sourceId).toBe('/works/OL15833435W')
    const none = await findBestMatch({ title: 'A Totally Different Book', authors: ['Nobody'] })
    expect(none).toBeNull()
  })
})
