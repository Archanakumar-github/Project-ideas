import { afterEach, describe, expect, it, vi } from 'vitest'
import { lookup, mergeEnrichment, shouldAutoEnrich } from '../src/enrich'
import { buildBooksQuery, mapVolume, pickVolume, type GoogleVolume } from '../src/enrich/books'
import { mapMicrolink, parseOpenGraph } from '../src/enrich/opengraph'
import { mapSummary, wikiImage } from '../src/enrich/wikipedia'
import { Repo } from '../src/db/repo'
import { nodeDriver } from './nodeDriver'

const PAGE = 'https://shop.example.com/products/brass-telescope'

describe('Open Graph parsing', () => {
  it('prefers og: tags, resolves relative images and decodes entities', () => {
    const html = `<!doctype html><html><head>
      <title>Ignored &amp; plain</title>
      <meta property="og:title" content="Brass Refractor &amp; Tripod">
      <meta content="Hand-finished 80mm refractor." property="og:description" />
      <meta property='og:image' content='/img/scope.jpg'>
      <meta property="og:image:width" content="1200"><meta property="og:image:height" content="800">
      <meta property="og:site_name" content="Example Optics">
      <meta property="product:price:amount" content="1249.00"><meta property="product:price:currency" content="USD">
    </head><body></body></html>`
    const e = parseOpenGraph(html, PAGE)
    expect(e.title).toBe('Brass Refractor & Tripod')
    expect(e.description).toBe('Hand-finished 80mm refractor.')
    expect(e.imageUrl).toBe('https://shop.example.com/img/scope.jpg')
    expect(e.imageAspect).toBe(1.5)
    expect(e.siteName).toBe('Example Optics')
    expect(e.price).toMatch(/1,249/)
  })

  it('falls back to JSON-LD, then <title> and meta description', () => {
    const ld = `<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
      {"@type":"WebPage"},
      {"@type":"Product","name":"Walnut Record Console","image":["http://cdn.example.com/console.jpg"],
       "brand":{"@type":"Brand","name":"Atelier"},"offers":{"price":"3400","priceCurrency":"EUR"}}]}</script>`
    const e = parseOpenGraph(`<head>${ld}<meta name="description" content="Plain description"></head>`, PAGE)
    expect(e.title).toBe('Walnut Record Console')
    expect(e.imageUrl).toBe('https://cdn.example.com/console.jpg')
    expect(e.byline).toBe('Atelier')
    expect(e.price).toMatch(/3,?400/)
    expect(e.description).toBe('Plain description')

    const bare = parseOpenGraph('<title>  Quiet   Page </title><script type="application/ld+json">{oops</script>', PAGE)
    expect(bare.title).toBe('Quiet Page')
    expect(bare.imageUrl).toBeUndefined()
  })

  it('drops non-http image schemes', () => {
    const e = parseOpenGraph('<meta property="og:image" content="javascript:alert(1)">', PAGE)
    expect(e.imageUrl).toBeUndefined()
  })

  it('maps Microlink previews', () => {
    expect(mapMicrolink({ status: 'fail' }, PAGE)).toBeNull()
    const e = mapMicrolink(
      { status: 'success', data: { title: 'Scope', image: { url: 'https://x.com/a.png', width: 400, height: 200 } } },
      PAGE,
    )
    expect(e).toMatchObject({ title: 'Scope', imageUrl: 'https://x.com/a.png', imageAspect: 2, source: 'microlink' })
  })
})

const meditations: GoogleVolume = {
  id: 'abc',
  volumeInfo: {
    title: 'Meditations',
    subtitle: 'A New Translation',
    authors: ['Marcus Aurelius'],
    publishedDate: '2002-05-14',
    description: '<p>Written in Greek by the <b>only</b> Roman emperor&#39;s hand.</p>',
    imageLinks: { thumbnail: 'http://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=1&edge=curl' },
    industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780812968255' }],
  },
}

describe('books', () => {
  it('builds queries for ISBNs and "title by author"', () => {
    expect(buildBooksQuery('978-0-8129-6825-5')).toBe('isbn:9780812968255')
    expect(buildBooksQuery('Meditations by Marcus Aurelius')).toBe('intitle:Meditations inauthor:Marcus Aurelius')
    expect(buildBooksQuery(' Cosmos ')).toBe('Cosmos')
  })

  it('maps a volume with a tidy, larger cover', () => {
    const e = mapVolume(meditations)
    expect(e.title).toBe('Meditations: A New Translation')
    expect(e.byline).toBe('Marcus Aurelius')
    expect(e.year).toBe(2002)
    expect(e.description).toBe("Written in Greek by the only Roman emperor's hand.")
    expect(e.imageUrl).toBe('https://books.google.com/books/content?id=abc&printsec=frontcover&img=1&zoom=2')
  })

  it('only accepts a confident match', () => {
    const other: GoogleVolume = { id: 'x', volumeInfo: { title: 'Cooking for Beginners' } }
    expect(pickVolume('Meditations', [other, meditations])?.id).toBe('abc')
    expect(pickVolume('Meditations', [other])).toBeNull()
    expect(pickVolume('9780812968255', [other])?.id).toBe('x')
  })
})

describe('wikipedia', () => {
  const skye = {
    type: 'standard',
    title: 'Isle of Skye',
    description: 'island in the Inner Hebrides, Scotland',
    extract: 'The Isle of Skye is the largest island in the Inner Hebrides.',
    thumbnail: { source: 'https://upload.wikimedia.org/x/thumb/a/ab/Skye.jpg/320px-Skye.jpg', width: 320, height: 213 },
    originalimage: { source: 'https://upload.wikimedia.org/x/a/ab/Skye.jpg', width: 4000, height: 2667 },
    content_urls: { mobile: { page: 'https://en.m.wikipedia.org/wiki/Isle_of_Skye' } },
  }

  it('maps close matches with a large, not enormous, image', () => {
    const e = mapSummary('isle of skye', skye)!
    expect(e.title).toBe('Isle of Skye')
    expect(e.byline).toBe('Island in the Inner Hebrides, Scotland')
    expect(e.imageUrl).toBe('https://upload.wikimedia.org/x/thumb/a/ab/Skye.jpg/1280px-Skye.jpg')
    expect(e.imageAspect).toBeCloseTo(1.5, 1)
    expect(wikiImage({ originalimage: { source: 'o.jpg', width: 800, height: 400 } })).toEqual({ url: 'o.jpg', aspect: 2 })
  })

  it('rejects disambiguation pages and unrelated articles', () => {
    expect(mapSummary('Skye', { ...skye, type: 'disambiguation' })).toBeNull()
    expect(mapSummary('Morning tea ritual', skye)).toBeNull()
  })
})

describe('lookup routing', () => {
  afterEach(() => vi.unstubAllGlobals())

  function stubFetch(routes: Record<string, unknown>) {
    const calls: string[] = []
    vi.stubGlobal('fetch', async (url: string) => {
      calls.push(url)
      const key = Object.keys(routes).find((k) => url.includes(k))
      if (!key) return new Response('nope', { status: 404 })
      const body = routes[key]
      return typeof body === 'string'
        ? new Response(body, { headers: { 'content-type': 'text/html' } })
        : Response.json(body)
    })
    return calls
  }

  it('decides when an automatic lookup is worthwhile', () => {
    expect(shouldAutoEnrich({ title: 'x', url: 'https://a.com', kind: null })).toBe(true)
    expect(shouldAutoEnrich({ title: 'Cosmos', url: null, kind: 'books' })).toBe(true)
    expect(shouldAutoEnrich({ title: 'Lofoten', url: null, kind: 'place' })).toBe(true)
    expect(shouldAutoEnrich({ title: 'Morning pages', url: null, kind: 'life' })).toBe(false)
    expect(shouldAutoEnrich({ title: '9780812968255', url: null, kind: null })).toBe(true)
  })

  it('reads links directly on device, through the preview API on the web', async () => {
    const calls = stubFetch({
      'api.microlink.io': { status: 'success', data: { title: 'Proxied' } },
      'shop.example.com': '<meta property="og:title" content="Direct">',
    })
    expect((await lookup({ title: '', url: PAGE, kind: null }))?.title).toBe('Direct')
    expect((await lookup({ title: '', url: PAGE, kind: null }, { viaProxy: true }))?.title).toBe('Proxied')
    expect(calls[1]).toContain(encodeURIComponent(PAGE))
  })

  it('uses an image link as the image without fetching it', async () => {
    const calls = stubFetch({})
    const e = await lookup({ title: '', url: 'https://cdn.example.com/a/view.JPG?w=2', kind: null })
    expect(e?.imageUrl).toBe('https://cdn.example.com/a/view.JPG?w=2')
    expect(calls).toEqual([])
  })

  it('looks books up on Google Books and places on Wikipedia', async () => {
    stubFetch({
      'googleapis.com/books/v1/volumes/abc': meditations,
      'googleapis.com/books/v1/volumes?': { items: [meditations] },
      'page/summary/Lofoten': {
        type: 'standard',
        title: 'Lofoten',
        extract: 'An archipelago.',
        thumbnail: { source: 'https://u/320px-L.jpg', width: 320, height: 240 },
      },
    })
    expect((await lookup({ title: 'Meditations', url: null, kind: 'books' }))?.byline).toBe('Marcus Aurelius')
    expect((await lookup({ title: 'Lofoten', url: null, kind: 'place' }))?.description).toBe('An archipelago.')
    expect(await lookup({ title: 'Morning pages', url: null, kind: 'life' })).toBeNull()
  })
})

describe('mergeEnrichment', () => {
  const repo = new Repo(nodeDriver())

  it('fills gaps without overwriting what the user wrote', () => {
    const item = repo.buildItem({
      title: 'My own title',
      notes: 'mine',
      description: 'Typed by me',
      meta: { byline: 'Me' },
    })
    const patch = mergeEnrichment(item, {
      source: 'opengraph',
      title: 'Page title',
      description: 'From the page',
      imageUrl: 'https://x/img.jpg',
      imageAspect: 1.25,
      byline: 'Shop',
      price: '$10',
    })
    expect(patch.title).toBeUndefined()
    expect(patch.description).toBeUndefined()
    expect(patch.imageUri).toBe('https://x/img.jpg')
    expect(patch.imageAspect).toBe(1.25)
    expect(patch.meta).toEqual({ byline: 'Me', price: '$10', remoteImageUrl: 'https://x/img.jpg' })
    expect(patch.enrichState).toBe('done')
    expect('notes' in patch).toBe(false)
  })

  it('replaces a placeholder title made from the link', () => {
    const item = repo.buildItem({ title: 'Brass telescope', meta: { autoTitle: true } })
    const patch = mergeEnrichment(item, { source: 'opengraph', title: 'Brass Refractor 80mm' })
    expect(patch.title).toBe('Brass Refractor 80mm')
    expect(patch.meta?.autoTitle).toBeUndefined()
  })

  it("keeps the user's own photo even on a manual refresh", () => {
    const item = repo.buildItem({ title: 'x', imageUri: 'local:mine.jpg' })
    expect(mergeEnrichment(item, { source: 'wikipedia', imageUrl: 'https://w/x.jpg' }, { replace: true }).imageUri).toBeUndefined()
    const fetched = repo.buildItem({ title: 'x', imageUri: 'local:dl.jpg', meta: { remoteImageUrl: 'https://old' } })
    expect(mergeEnrichment(fetched, { source: 'wikipedia', imageUrl: 'https://w/x.jpg' }, { replace: true }).imageUri).toBe(
      'https://w/x.jpg',
    )
  })
})
