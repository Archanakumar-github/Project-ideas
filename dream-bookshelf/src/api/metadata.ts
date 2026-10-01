/**
 * Provider-agnostic metadata layer: Open Library first, Google Books as fallback, with
 * de-duplication, field merging and confidence-scored matching for background enrichment.
 */
import { HttpError, OfflineError, isAbortError, isOnline } from './http'
import { fetchOpenLibraryWork, searchOpenLibrary } from './openLibrary'
import { searchGoogleBooks } from './googleBooks'
import type { BookCandidate, SearchOutcome, SearchScope } from './types'
import type { Book, BookDraft } from '../db/types'
import { looksLikeIsbn, toIsbn13 } from '../lib/isbn'
import { normalize, titleKey } from '../lib/utils'
import { getSettings } from '../store/settings'

export class LookupsDisabledError extends Error {
  constructor() {
    super('Online lookups are turned off in Settings')
  }
}

export function resolveScope(query: string, scope: SearchScope): SearchScope {
  if (scope === 'all' && looksLikeIsbn(query)) return 'isbn'
  return scope
}

function lastName(author: string): string {
  const parts = normalize(author).split(' ')
  return parts[parts.length - 1] ?? ''
}

function dedupeKey(c: Pick<BookCandidate, 'title' | 'authors'>): string {
  return `${titleKey(c.title)}|${lastName(c.authors[0] ?? '')}`
}

/** Fill gaps in `primary` with data from `secondary` (primary wins on conflicts). */
export function mergeCandidates(primary: BookCandidate, secondary: BookCandidate): BookCandidate {
  const merged: BookCandidate = { ...primary }
  const fill = <K extends keyof BookCandidate>(k: K) => {
    if (merged[k] === undefined || merged[k] === '') merged[k] = secondary[k]
  }
  ;(
    [
      'subtitle', 'publishYear', 'pageCount', 'isbn', 'description', 'coverUrl', 'thumbUrl',
      'seriesName', 'seriesIndex', 'price', 'currency', 'link',
    ] as const
  ).forEach(fill)
  if (merged.authors.length === 0) merged.authors = secondary.authors
  if (merged.subjects.length === 0) merged.subjects = secondary.subjects
  // Keep price + currency paired.
  if (primary.price === undefined && secondary.price !== undefined) merged.currency = secondary.currency
  return merged
}

export function dedupeCandidates(list: BookCandidate[]): BookCandidate[] {
  const out: BookCandidate[] = []
  const byKey = new Map<string, number>()
  for (const c of list) {
    const keys = [dedupeKey(c), c.isbn ? `isbn:${c.isbn}` : ''].filter(Boolean)
    const hit = keys.map((k) => byKey.get(k)).find((i) => i !== undefined)
    if (hit !== undefined) {
      out[hit] = mergeCandidates(out[hit], c)
    } else {
      out.push(c)
      keys.forEach((k) => byKey.set(k, out.length - 1))
    }
  }
  return out
}

function describeProviderError(provider: string, err: unknown): string {
  if (err instanceof HttpError && err.isRateLimit) {
    return provider === 'Google Books'
      ? 'Google Books is rate-limiting requests — adding your own API key in Settings helps.'
      : `${provider} is rate-limiting requests right now.`
  }
  if (isAbortError(err)) return `${provider} took too long to answer.`
  return `${provider} is unavailable right now.`
}

/** Online search with graceful degradation; throws only if every provider failed. */
export async function searchBooks(
  rawQuery: string,
  rawScope: SearchScope = 'all',
  { signal }: { signal?: AbortSignal } = {},
): Promise<SearchOutcome> {
  const query = rawQuery.trim()
  const outcome: SearchOutcome = { results: [], sources: [], warnings: [] }
  if (query.length < 2) return outcome

  const settings = getSettings()
  if (!settings.onlineLookups) throw new LookupsDisabledError()
  if (!isOnline()) throw new OfflineError()

  const scope = resolveScope(query, rawScope)
  let firstError: unknown

  let ol: BookCandidate[] = []
  try {
    ol = await searchOpenLibrary(query, scope, signal)
    outcome.sources.push('openlibrary')
  } catch (err) {
    if (signal?.aborted) throw err
    firstError = err
    outcome.warnings.push(describeProviderError('Open Library', err))
  }

  const thin = scope === 'isbn' ? ol.length === 0 || !ol[0].coverUrl || !ol[0].description : ol.length < 4
  let google: BookCandidate[] = []
  if (settings.googleFallback && thin) {
    try {
      google = await searchGoogleBooks(query, scope, { apiKey: settings.googleApiKey || undefined, signal })
      outcome.sources.push('google')
    } catch (err) {
      if (signal?.aborted) throw err
      firstError ??= err
      outcome.warnings.push(describeProviderError('Google Books', err))
    }
  }

  if (outcome.sources.length === 0 && firstError) throw firstError

  if (scope === 'isbn') {
    // For an exact ISBN, both providers describe the same book: fold them together.
    const isbn = toIsbn13(query)
    const all = [...ol, ...google].map((c) => ({ ...c, isbn: c.isbn ?? isbn }))
    outcome.results = all.length ? [all.slice(1).reduce(mergeCandidates, all[0])] : []
  } else {
    outcome.results = dedupeCandidates([...ol, ...google])
  }
  return outcome
}

/**
 * Called when the user taps a result to preview it: fills the description (and anything else
 * missing) without blocking the save button.
 */
export async function enrichCandidate(c: BookCandidate, signal?: AbortSignal): Promise<BookCandidate> {
  let out = c
  const settings = getSettings()
  if (!settings.onlineLookups || !isOnline()) return out
  if (out.source === 'openlibrary' && !out.description) {
    try {
      const work = await fetchOpenLibraryWork(out.sourceId, signal)
      out = { ...out, description: work.description, subjects: out.subjects.length ? out.subjects : work.subjects }
    } catch {
      /* best effort */
    }
  }
  if (settings.googleFallback && out.isbn && (!out.description || !out.coverUrl || out.seriesIndex === undefined)) {
    try {
      const [g] = await searchGoogleBooks(out.isbn, 'isbn', { apiKey: settings.googleApiKey || undefined, signal })
      if (g) out = mergeCandidates(out, g)
    } catch {
      /* best effort */
    }
  }
  return out
}

/* ------------------------------------------------------------------------------------------
 * Matching (background enrichment of manual / offline entries)
 * ---------------------------------------------------------------------------------------- */

function words(s: string): Set<string> {
  return new Set(titleKey(s).split(' ').filter(Boolean))
}

/** 0..1 similarity of two titles (exact, prefix, then Dice coefficient on words). */
export function titleSimilarity(a: string, b: string): number {
  const ka = titleKey(a)
  const kb = titleKey(b)
  if (!ka || !kb) return 0
  if (ka === kb) return 1
  if (ka.startsWith(kb + ' ') || kb.startsWith(ka + ' ')) return 0.85
  const wa = words(a)
  const wb = words(b)
  let common = 0
  wa.forEach((w) => wb.has(w) && common++)
  return (2 * common) / (wa.size + wb.size)
}

export function scoreMatch(book: Pick<Book, 'title' | 'authors' | 'isbn'>, c: BookCandidate): number {
  if (book.isbn && c.isbn && book.isbn === c.isbn) return 1
  const t = titleSimilarity(book.title, c.title)
  if (book.authors.length === 0) return t * 0.9
  const wanted = new Set(book.authors.map(lastName))
  const authorHit = c.authors.some((a) => wanted.has(lastName(a)))
  return authorHit ? t : t * 0.6
}

export const MATCH_THRESHOLD = 0.8

export async function findBestMatch(
  book: Pick<Book, 'title' | 'authors' | 'isbn'>,
  signal?: AbortSignal,
): Promise<BookCandidate | null> {
  if (book.isbn) {
    const { results } = await searchBooks(book.isbn, 'isbn', { signal })
    if (results[0]) return results[0]
  }
  const query = [book.title, book.authors[0]].filter(Boolean).join(' ')
  const { results } = await searchBooks(query, 'all', { signal })
  let best: BookCandidate | null = null
  let bestScore = 0
  for (const c of results) {
    const s = scoreMatch(book, c)
    if (s > bestScore) {
      best = c
      bestScore = s
    }
  }
  return bestScore >= MATCH_THRESHOLD ? best : null
}

/** Only fills fields the user left empty — never overwrites their edits. */
export function candidateToBookPatch(book: Book, c: BookCandidate): Partial<Book> {
  const patch: Partial<Book> = {}
  // Offline ISBN placeholders ("ISBN 978-…") get the real title.
  if (book.isbn && /^ISBN [\d-]+X?$/.test(book.title)) patch.title = c.title
  if (!book.subtitle && c.subtitle) patch.subtitle = c.subtitle
  if (book.authors.length === 0 && c.authors.length) patch.authors = c.authors
  if (!book.publishYear && c.publishYear) patch.publishYear = c.publishYear
  if (!book.pageCount && c.pageCount) patch.pageCount = c.pageCount
  if (!book.isbn && c.isbn) patch.isbn = c.isbn
  if (!book.description && c.description) patch.description = c.description
  if (!book.coverUrl && !book.coverId && c.coverUrl) patch.coverUrl = c.coverUrl
  if (book.price === undefined && c.price !== undefined) {
    patch.price = c.price
    patch.currency = c.currency
  }
  if (!book.link && c.link) patch.link = c.link
  if (!book.sourceId) {
    patch.sourceId = c.sourceId
    if (book.source === 'manual') patch.source = c.source
  }
  return patch
}

export function candidateToDraft(c: BookCandidate): BookDraft {
  return {
    title: c.title,
    subtitle: c.subtitle,
    authors: c.authors,
    publishYear: c.publishYear,
    pageCount: c.pageCount,
    isbn: c.isbn,
    description: c.description,
    coverUrl: c.coverUrl,
    price: c.price,
    currency: c.currency,
    link: c.link,
    source: c.source,
    sourceId: c.sourceId,
    metadataState: 'complete',
  }
}

export function isOfflineError(err: unknown) {
  return err instanceof OfflineError
}
