import { describe, expect, it } from 'vitest'
import { buildOpenLibrarySearchUrl, cleanDescription, mapOpenLibraryDoc } from './openLibrary'
import { buildGoogleBooksUrl, mapGoogleVolume, stripHtml, tidyGoogleImage } from './googleBooks'
import { olLeviathan } from '../test/fixtures/openLibrary'
import { gbLeviathan } from '../test/fixtures/googleBooks'

describe('Open Library', () => {
  it('builds scoped search URLs', () => {
    expect(buildOpenLibrarySearchUrl('dune', 'title')).toContain('title=dune')
    expect(buildOpenLibrarySearchUrl('le guin', 'author')).toContain('author=le+guin')
    expect(buildOpenLibrarySearchUrl('978-0-316-12908-4', 'isbn')).toContain('isbn=9780316129084')
    expect(buildOpenLibrarySearchUrl('dune', 'all')).toMatch(/\?q=dune&fields=/)
  })

  it('maps a search doc to a candidate', () => {
    const c = mapOpenLibraryDoc(olLeviathan.docs[0])
    expect(c).toMatchObject({
      key: 'openlibrary:/works/OL15833435W',
      title: 'Leviathan Wakes',
      authors: ['James S. A. Corey'],
      publishYear: 2011,
      pageCount: 592,
      isbn: '9780316129084',
      coverUrl: 'https://covers.openlibrary.org/b/id/6655616-L.jpg',
      thumbUrl: 'https://covers.openlibrary.org/b/id/6655616-M.jpg',
      seriesName: 'The Expanse',
      seriesIndex: 1,
      subjects: ['Science fiction', 'Space warfare'],
      link: 'https://openlibrary.org/works/OL15833435W',
    })
  })

  it('falls back to the ISBN cover endpoint', () => {
    const c = mapOpenLibraryDoc(olLeviathan.docs[1], '9780316129084')
    expect(c.coverUrl).toBe('https://covers.openlibrary.org/b/isbn/9780316129084-L.jpg?default=false')
    expect(c.title).toBe('Leviathan Wakes (The Expanse, #1) Collector edition')
  })

  it('cleans description boilerplate', () => {
    expect(cleanDescription('A story.\n\n----------\nContains:\n[Book](https://x)')).toBe('A story.')
    expect(cleanDescription('See [the site](https://example.com) now')).toBe('See the site now')
  })
})

describe('Google Books', () => {
  it('builds scoped URLs with optional key', () => {
    const url = new URL(buildGoogleBooksUrl('dune', 'title', { apiKey: 'k' }))
    expect(url.searchParams.get('q')).toBe('intitle:dune')
    expect(url.searchParams.get('key')).toBe('k')
    expect(new URL(buildGoogleBooksUrl('0316129089', 'isbn')).searchParams.get('q')).toBe('isbn:0316129089')
  })

  it('maps a volume to a candidate', () => {
    const c = mapGoogleVolume(gbLeviathan.items![0])!
    expect(c).toMatchObject({
      source: 'google',
      title: 'Leviathan Wakes',
      isbn: '9780316129084',
      publishYear: 2011,
      pageCount: 582,
      price: 9.99,
      currency: 'USD',
      seriesIndex: 1,
      link: 'https://play.google.com/store/books/details?id=yud-foNMy4wC',
    })
    expect(c.coverUrl).toMatch(/^https:\/\/books\.google\.com/)
    expect(c.coverUrl).not.toContain('edge=curl')
    expect(c.description).toBe("Humanity has colonized the solar system's planets.\n\nJim Holden's ship finds a derelict.")
  })

  it('tidies images and HTML', () => {
    expect(tidyGoogleImage('http://x/y?a=1&edge=curl')).toBe('https://x/y?a=1')
    expect(stripHtml('<b>Bold</b> &amp; <i>brave</i><br>next')).toBe('Bold & brave\nnext')
  })
})
