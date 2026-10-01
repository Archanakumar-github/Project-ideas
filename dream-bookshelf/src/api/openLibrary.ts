/**
 * Open Library (https://openlibrary.org/dev/docs/api) — free, keyless, privacy-friendly.
 * Primary metadata provider.
 */
import { fetchJson } from './http'
import type { BookCandidate, SearchScope } from './types'
import { parseSeriesFromTitle, parseSeriesString } from './series'
import { cleanIsbn, toIsbn13 } from '../lib/isbn'
import { uniqText } from '../lib/utils'

export const OPEN_LIBRARY = 'https://openlibrary.org'
export const OPEN_LIBRARY_COVERS = 'https://covers.openlibrary.org'

const SEARCH_FIELDS = [
  'key',
  'title',
  'subtitle',
  'author_name',
  'first_publish_year',
  'number_of_pages_median',
  'isbn',
  'cover_i',
  'subject',
  'series',
].join(',')

export interface OpenLibraryDoc {
  key: string
  title: string
  subtitle?: string
  author_name?: string[]
  first_publish_year?: number
  number_of_pages_median?: number
  isbn?: string[]
  cover_i?: number
  subject?: string[]
  series?: string[] | string
}

export interface OpenLibrarySearchResponse {
  numFound: number
  docs: OpenLibraryDoc[]
}

export function buildOpenLibrarySearchUrl(query: string, scope: SearchScope, limit = 12): string {
  const params = new URLSearchParams()
  const q = query.trim()
  if (scope === 'title') params.set('title', q)
  else if (scope === 'author') params.set('author', q)
  else if (scope === 'isbn') params.set('isbn', cleanIsbn(q))
  else params.set('q', q)
  params.set('fields', SEARCH_FIELDS)
  params.set('limit', String(limit))
  return `${OPEN_LIBRARY}/search.json?${params}`
}

export function openLibraryCoverUrl(coverId: number, size: 'S' | 'M' | 'L' = 'L') {
  return `${OPEN_LIBRARY_COVERS}/b/id/${coverId}-${size}.jpg`
}

export function openLibraryIsbnCoverUrl(isbn: string, size: 'S' | 'M' | 'L' = 'L') {
  // default=false makes a missing cover a 404 instead of a 1x1 placeholder GIF.
  return `${OPEN_LIBRARY_COVERS}/b/isbn/${isbn}-${size}.jpg?default=false`
}

/** Picks a representative ISBN-13 from a work's (often huge) edition ISBN list. */
function pickIsbn(isbns: string[] | undefined): string | undefined {
  if (!isbns?.length) return undefined
  const valid = isbns.map(toIsbn13).filter((i): i is string => !!i)
  // Prefer English-language registration groups (978-0 / 978-1) for a likelier match.
  return valid.find((i) => i.startsWith('9780') || i.startsWith('9781')) ?? valid[0]
}

export function mapOpenLibraryDoc(doc: OpenLibraryDoc, isbnHint?: string): BookCandidate {
  const isbn = isbnHint ?? pickIsbn(doc.isbn)
  const fromTitle = parseSeriesFromTitle(doc.title, doc.subtitle)
  const seriesRaw = Array.isArray(doc.series) ? doc.series[0] : doc.series
  const fromField = parseSeriesString(seriesRaw)

  let coverUrl: string | undefined
  let thumbUrl: string | undefined
  if (doc.cover_i) {
    coverUrl = openLibraryCoverUrl(doc.cover_i, 'L')
    thumbUrl = openLibraryCoverUrl(doc.cover_i, 'M')
  } else if (isbnHint) {
    coverUrl = openLibraryIsbnCoverUrl(isbnHint, 'L')
    thumbUrl = openLibraryIsbnCoverUrl(isbnHint, 'M')
  }

  return {
    key: `openlibrary:${doc.key}`,
    source: 'openlibrary',
    sourceId: doc.key,
    title: fromTitle.title,
    subtitle: doc.subtitle,
    authors: uniqText(doc.author_name ?? []),
    publishYear: doc.first_publish_year,
    pageCount: doc.number_of_pages_median,
    isbn,
    coverUrl,
    thumbUrl,
    seriesName: fromField.name ?? fromTitle.name,
    seriesIndex: fromField.index ?? fromTitle.index,
    subjects: uniqText(doc.subject ?? []).slice(0, 8),
    link: `${OPEN_LIBRARY}${doc.key}`,
  }
}

export async function searchOpenLibrary(
  query: string,
  scope: SearchScope,
  signal?: AbortSignal,
): Promise<BookCandidate[]> {
  const url = buildOpenLibrarySearchUrl(query, scope)
  const data = await fetchJson<OpenLibrarySearchResponse>(url, { signal, timeoutMs: 7000 })
  const isbnHint = scope === 'isbn' ? toIsbn13(query) : undefined
  return (data.docs ?? []).filter((d) => d.key && d.title).map((d) => mapOpenLibraryDoc(d, isbnHint))
}

interface OpenLibraryWork {
  description?: string | { value?: string }
  subjects?: string[]
}

/** Work-level details (the search index has no descriptions). */
export async function fetchOpenLibraryWork(
  workKey: string,
  signal?: AbortSignal,
): Promise<{ description?: string; subjects: string[] }> {
  if (!workKey.startsWith('/works/')) return { subjects: [] }
  const work = await fetchJson<OpenLibraryWork>(`${OPEN_LIBRARY}${workKey}.json`, { signal, timeoutMs: 6000 })
  const raw = typeof work.description === 'string' ? work.description : work.description?.value
  return { description: cleanDescription(raw), subjects: uniqText(work.subjects ?? []).slice(0, 8) }
}

/** Open Library descriptions often end with markdown link lists / source notes. */
export function cleanDescription(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const text = raw
    .replace(/\r\n/g, '\n')
    .split(/\n-{3,}\n|\n\*\*Contains:?\*\*|\n\(\[source\]/i)[0]
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text || undefined
}
