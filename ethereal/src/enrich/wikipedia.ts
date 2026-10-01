/**
 * Places (and anything else the user asks to look up) from Wikipedia's REST summary API:
 * a short extract plus the article's lead photograph.
 */
import { fetchJson, HttpError, type FetchOptions } from './http'
import type { Enrichment } from './types'
import { normalizeForMatch, wordOverlap } from '../lib/text'

const API = 'https://en.wikipedia.org'

export interface WikiSummary {
  type?: string
  title?: string
  extract?: string
  description?: string
  thumbnail?: { source: string; width: number; height: number }
  originalimage?: { source: string; width: number; height: number }
  content_urls?: { desktop?: { page?: string }; mobile?: { page?: string } }
}

/** A large but not enormous rendition of the lead image. */
export function wikiImage(s: WikiSummary): { url: string; aspect: number } | undefined {
  const orig = s.originalimage
  const thumb = s.thumbnail
  const base = orig ?? thumb
  if (!base) return undefined
  const aspect = base.width / base.height
  if (orig && orig.width <= 1600) return { url: orig.source, aspect }
  if (thumb && /\/\d+px-/.test(thumb.source)) return { url: thumb.source.replace(/\/\d+px-/, '/1280px-'), aspect }
  return { url: base.source, aspect }
}

export function mapSummary(query: string, s: WikiSummary): Enrichment | null {
  if (!s.title || s.type === 'disambiguation' || s.type === 'no-extract') return null
  // Only accept an article that is clearly about what was typed.
  const close =
    normalizeForMatch(s.title) === normalizeForMatch(query) ||
    (wordOverlap(query, s.title) >= 0.75 && wordOverlap(s.title, query) >= 0.5)
  if (!close) return null
  const img = wikiImage(s)
  return {
    source: 'wikipedia',
    title: s.title,
    description: s.extract?.trim() || undefined,
    byline: s.description ? s.description[0].toUpperCase() + s.description.slice(1) : undefined,
    imageUrl: img?.url,
    imageAspect: img?.aspect,
    siteName: 'Wikipedia',
    url: s.content_urls?.mobile?.page ?? s.content_urls?.desktop?.page,
  }
}

async function summary(title: string, opts: FetchOptions): Promise<WikiSummary | null> {
  try {
    return await fetchJson<WikiSummary>(
      `${API}/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}?redirect=true`,
      { timeoutMs: 7000, ...opts },
    )
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) return null
    throw err
  }
}

export async function lookupWikipedia(query: string, opts: FetchOptions = {}): Promise<Enrichment | null> {
  const direct = await summary(query, opts)
  const hit = direct ? mapSummary(query, direct) : null
  if (hit) return hit
  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: '1',
    format: 'json',
    origin: '*',
  })
  const search = await fetchJson<{ query?: { search?: Array<{ title: string }> } }>(`${API}/w/api.php?${params}`, {
    timeoutMs: 7000,
    ...opts,
  })
  const top = search.query?.search?.[0]?.title
  if (!top) return null
  const s = await summary(top, opts)
  return s ? mapSummary(query, s) : null
}
