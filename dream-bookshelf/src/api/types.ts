export type SearchScope = 'all' | 'title' | 'author' | 'isbn'

/** A normalized search result from any metadata provider. */
export interface BookCandidate {
  /** `${source}:${sourceId}` — stable React key. */
  key: string
  source: 'openlibrary' | 'google'
  sourceId: string
  title: string
  subtitle?: string
  authors: string[]
  publishYear?: number
  pageCount?: number
  isbn?: string
  description?: string
  /** Large cover for detail views / offline caching. */
  coverUrl?: string
  /** Small cover for result lists. */
  thumbUrl?: string
  seriesName?: string
  seriesIndex?: number
  subjects: string[]
  price?: number
  currency?: string
  link?: string
}

export interface SearchOutcome {
  results: BookCandidate[]
  /** Providers that answered successfully. */
  sources: Array<BookCandidate['source']>
  /** Human-readable provider problems (rate limits, timeouts) for a subtle footnote. */
  warnings: string[]
}
