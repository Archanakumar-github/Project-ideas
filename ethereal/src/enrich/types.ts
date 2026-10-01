/** What a lookup can tell us about a desire. Every field is optional. */
export interface Enrichment {
  title?: string
  description?: string
  imageUrl?: string
  /** width / height when the provider reports dimensions. */
  imageAspect?: number
  siteName?: string
  byline?: string
  price?: string
  year?: number
  url?: string
  source: 'opengraph' | 'google-books' | 'open-library' | 'wikipedia' | 'microlink'
}
