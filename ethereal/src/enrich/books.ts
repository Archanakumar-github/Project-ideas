/**
 * Book lookups: Google Books for details, with Open Library's large covers as a fallback.
 * Both send only the title (or ISBN) you typed. Neither needs a key.
 */
import { fetchJson, type FetchOptions } from './http'
import type { Enrichment } from './types'
import { asIsbn, stripHtml, wordOverlap } from '../lib/text'

const GOOGLE = 'https://www.googleapis.com/books/v1/volumes'

type ImageLinks = Partial<Record<'smallThumbnail' | 'thumbnail' | 'small' | 'medium' | 'large' | 'extraLarge', string>>

export interface GoogleVolume {
  id: string
  volumeInfo?: {
    title?: string
    subtitle?: string
    authors?: string[]
    publishedDate?: string
    description?: string
    industryIdentifiers?: Array<{ type: string; identifier: string }>
    imageLinks?: ImageLinks
    canonicalVolumeLink?: string
    infoLink?: string
  }
  saleInfo?: { retailPrice?: { amount?: number; currencyCode?: string } }
}

/** "Meditations by Marcus Aurelius" → intitle + inauthor; an ISBN → isbn:. */
export function buildBooksQuery(input: string): string {
  const isbn = asIsbn(input)
  if (isbn) return `isbn:${isbn}`
  const by = input.match(/^(.+?)\s+by\s+(.+)$/i)
  if (by) return `intitle:${by[1].trim()} inauthor:${by[2].trim()}`
  return input.trim()
}

/** Google image links are http:// with a page-curl effect; ask for a larger rendition too. */
export function bestGoogleImage(links: ImageLinks | undefined): string | undefined {
  if (!links) return undefined
  const url = links.extraLarge ?? links.large ?? links.medium ?? links.small ?? links.thumbnail ?? links.smallThumbnail
  if (!url) return undefined
  return url
    .replace(/^http:\/\//, 'https://')
    .replace(/&edge=curl/g, '')
    .replace(/([?&])zoom=1\b/, '$1zoom=2')
}

export function isbnOf(v: GoogleVolume): string | undefined {
  const ids = v.volumeInfo?.industryIdentifiers ?? []
  return ids.find((i) => i.type === 'ISBN_13')?.identifier ?? ids.find((i) => i.type === 'ISBN_10')?.identifier
}

/** Picks the result that really is the book asked for, or none. */
export function pickVolume(query: string, items: GoogleVolume[]): GoogleVolume | null {
  if (asIsbn(query)) return items[0] ?? null
  const titlePart = query.replace(/\s+by\s+.+$/i, '')
  let best: GoogleVolume | null = null
  let bestScore = 0
  for (const v of items.slice(0, 8)) {
    const info = v.volumeInfo
    if (!info?.title) continue
    const full = `${info.title} ${info.subtitle ?? ''} ${(info.authors ?? []).join(' ')}`
    const score =
      wordOverlap(titlePart, `${info.title} ${info.subtitle ?? ''}`) * 2 +
      wordOverlap(query, full) +
      (info.imageLinks ? 0.3 : 0) +
      (info.description ? 0.2 : 0)
    if (score > bestScore) {
      best = v
      bestScore = score
    }
  }
  return bestScore >= 1.5 ? best : null
}

export function mapVolume(v: GoogleVolume): Enrichment {
  const info = v.volumeInfo ?? {}
  const year = info.publishedDate ? Number.parseInt(info.publishedDate.slice(0, 4), 10) : NaN
  const price = v.saleInfo?.retailPrice
  return {
    source: 'google-books',
    title: info.subtitle && info.subtitle.length < 60 ? `${info.title}: ${info.subtitle}` : info.title,
    byline: info.authors?.length ? info.authors.join(', ') : undefined,
    description: stripHtml(info.description) || undefined,
    imageUrl: bestGoogleImage(info.imageLinks),
    // Book covers are close enough to 2:3 to lay the grid out before the image arrives.
    imageAspect: 2 / 3,
    year: Number.isFinite(year) ? year : undefined,
    price:
      price?.amount && price.currencyCode
        ? new Intl.NumberFormat(undefined, { style: 'currency', currency: price.currencyCode }).format(price.amount)
        : undefined,
    siteName: 'Google Books',
    url: info.canonicalVolumeLink ?? info.infoLink,
  }
}

export function openLibraryCover(isbn: string): string {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`
}

export async function lookupBook(input: string, opts: FetchOptions = {}): Promise<Enrichment | null> {
  const params = new URLSearchParams({ q: buildBooksQuery(input), maxResults: '8', printType: 'books' })
  const res = await fetchJson<{ items?: GoogleVolume[] }>(`${GOOGLE}?${params}`, { timeoutMs: 8000, ...opts })
  const pick = pickVolume(input, res.items ?? [])
  if (!pick) return null
  // The search result only has thumbnails; the volume itself lists the large renditions.
  let volume = pick
  try {
    volume = await fetchJson<GoogleVolume>(`${GOOGLE}/${encodeURIComponent(pick.id)}`, { timeoutMs: 6000, ...opts })
  } catch {
    // Keep the search result.
  }
  const out = mapVolume(volume)
  const isbn = isbnOf(volume)
  if (isbn && !volume.volumeInfo?.imageLinks?.large && !volume.volumeInfo?.imageLinks?.medium) {
    out.imageUrl = out.imageUrl ?? openLibraryCover(isbn)
  }
  return out
}
