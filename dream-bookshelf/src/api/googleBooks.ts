/**
 * Google Books API (https://developers.google.com/books) — fallback provider. Works without a
 * key, but the anonymous quota is shared per IP/project and can be exhausted; users can add
 * their own key in Settings.
 */
import { fetchJson } from './http'
import type { BookCandidate, SearchScope } from './types'
import { parseSeriesFromTitle, parseVolumeNumber } from './series'
import { cleanIsbn, toIsbn13 } from '../lib/isbn'
import { uniqText } from '../lib/utils'

export const GOOGLE_BOOKS = 'https://www.googleapis.com/books/v1/volumes'

const FIELDS =
  'items(id,volumeInfo(title,subtitle,authors,publishedDate,description,industryIdentifiers,pageCount,categories,imageLinks,infoLink,canonicalVolumeLink,seriesInfo),saleInfo(listPrice,retailPrice,buyLink))'

export interface GoogleVolume {
  id: string
  volumeInfo?: {
    title?: string
    subtitle?: string
    authors?: string[]
    publishedDate?: string
    description?: string
    industryIdentifiers?: Array<{ type: string; identifier: string }>
    pageCount?: number
    categories?: string[]
    imageLinks?: { smallThumbnail?: string; thumbnail?: string; small?: string; medium?: string; large?: string }
    infoLink?: string
    canonicalVolumeLink?: string
    seriesInfo?: { bookDisplayNumber?: string }
  }
  saleInfo?: {
    listPrice?: { amount?: number; currencyCode?: string }
    retailPrice?: { amount?: number; currencyCode?: string }
    buyLink?: string
  }
}

export interface GoogleBooksResponse {
  totalItems?: number
  items?: GoogleVolume[]
}

export function buildGoogleBooksUrl(
  query: string,
  scope: SearchScope,
  { apiKey, limit = 12 }: { apiKey?: string; limit?: number } = {},
): string {
  const q = query.trim()
  const term =
    scope === 'title' ? `intitle:${q}` : scope === 'author' ? `inauthor:${q}` : scope === 'isbn' ? `isbn:${cleanIsbn(q)}` : q
  const params = new URLSearchParams({ q: term, maxResults: String(limit), printType: 'books', fields: FIELDS })
  if (apiKey) params.set('key', apiKey)
  return `${GOOGLE_BOOKS}?${params}`
}

/** Google image links are http:// and carry a page-curl effect; tidy both. */
export function tidyGoogleImage(url: string | undefined): string | undefined {
  if (!url) return undefined
  return url.replace(/^http:\/\//, 'https://').replace(/&edge=curl/g, '')
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" }

export function stripHtml(html: string | undefined): string | undefined {
  if (!html) return undefined
  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#\d+|#39|[a-z]+);/gi, (m, e: string) => {
      if (ENTITIES[e]) return ENTITIES[e]
      if (e.startsWith('#')) return String.fromCharCode(Number(e.slice(1)))
      return m
    })
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text || undefined
}

export function mapGoogleVolume(item: GoogleVolume): BookCandidate | null {
  const info = item.volumeInfo
  if (!info?.title) return null
  const ids = info.industryIdentifiers ?? []
  const isbn =
    toIsbn13(ids.find((i) => i.type === 'ISBN_13')?.identifier) ??
    toIsbn13(ids.find((i) => i.type === 'ISBN_10')?.identifier)
  const year = info.publishedDate ? Number.parseInt(info.publishedDate.slice(0, 4), 10) : undefined
  const parsed = parseSeriesFromTitle(info.title, info.subtitle)
  const price = item.saleInfo?.retailPrice ?? item.saleInfo?.listPrice
  const images = info.imageLinks ?? {}
  const thumb = tidyGoogleImage(images.thumbnail ?? images.smallThumbnail)

  return {
    key: `google:${item.id}`,
    source: 'google',
    sourceId: item.id,
    title: parsed.title,
    subtitle: parsed.name && info.subtitle && /book|volume|#/i.test(info.subtitle) ? undefined : info.subtitle,
    authors: uniqText(info.authors ?? []),
    publishYear: Number.isFinite(year) ? year : undefined,
    pageCount: info.pageCount || undefined,
    isbn,
    description: stripHtml(info.description),
    coverUrl: tidyGoogleImage(images.medium ?? images.small) ?? thumb,
    thumbUrl: thumb,
    seriesName: parsed.name,
    seriesIndex: parsed.index ?? parseVolumeNumber(info.seriesInfo?.bookDisplayNumber),
    subjects: uniqText(info.categories ?? []),
    price: price?.amount,
    currency: price?.currencyCode,
    link: item.saleInfo?.buyLink ?? info.canonicalVolumeLink ?? info.infoLink,
  }
}

export async function searchGoogleBooks(
  query: string,
  scope: SearchScope,
  { apiKey, signal }: { apiKey?: string; signal?: AbortSignal } = {},
): Promise<BookCandidate[]> {
  const data = await fetchJson<GoogleBooksResponse>(buildGoogleBooksUrl(query, scope, { apiKey }), {
    signal,
    timeoutMs: 7000,
  })
  return (data.items ?? []).map(mapGoogleVolume).filter((c): c is BookCandidate => !!c)
}
