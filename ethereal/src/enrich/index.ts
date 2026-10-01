/**
 * Picks the right online source for a desire and folds the answer into it, filling gaps only.
 * Nothing here blocks saving: the item is already on the device before any lookup starts.
 */
import type { CategoryKind, Item, ItemPatch } from '../db/types'
import { asIsbn } from '../lib/text'
import { lookupBook } from './books'
import type { FetchOptions } from './http'
import { fetchOpenGraph } from './opengraph'
import type { Enrichment } from './types'
import { lookupWikipedia } from './wikipedia'

export type { Enrichment } from './types'

export interface EnrichRequest {
  title: string
  url: string | null
  kind: CategoryKind | null
  /** The user asked for it ("Find details"): try every source, whatever the category. */
  manual?: boolean
}

export interface EnrichOptions extends FetchOptions {
  /** Browser build: fetch link previews through Microlink, since CORS blocks direct reads. */
  viaProxy?: boolean
}

const IMAGE_URL = /\.(jpe?g|png|webp|gif|avif|heic)(\?.*)?$/i

/** Whether an item has anything worth looking up automatically. */
export function shouldAutoEnrich(req: EnrichRequest): boolean {
  if (req.url) return true
  if (!req.title.trim()) return false
  return req.kind === 'books' || req.kind === 'place' || !!asIsbn(req.title)
}

export async function lookup(req: EnrichRequest, opts: EnrichOptions = {}): Promise<Enrichment | null> {
  const { viaProxy, ...fetchOpts } = opts
  if (req.url) {
    if (IMAGE_URL.test(new URL(req.url).pathname)) return { source: 'opengraph', imageUrl: req.url, url: req.url }
    return fetchOpenGraph(req.url, { viaProxy, ...fetchOpts })
  }
  const title = req.title.trim()
  if (!title) return null
  if (req.kind === 'books' || asIsbn(title)) {
    return (await lookupBook(title, fetchOpts)) ?? (req.manual ? lookupWikipedia(title, fetchOpts) : null)
  }
  if (req.kind === 'place' || req.manual) {
    return (await lookupWikipedia(title, fetchOpts)) ?? (req.manual ? lookupBook(title, fetchOpts) : null)
  }
  return null
}

/**
 * The patch that applies a lookup to an item. It never overwrites what the user wrote: the
 * title only changes while it is still a placeholder made from the link, and the image,
 * description and details are filled only where empty (or everything, when `replace` is set
 * by an explicit "Find details" on an item with no photo of the user's own).
 */
export function mergeEnrichment(item: Item, e: Enrichment, { replace = false } = {}): ItemPatch {
  const patch: ItemPatch = { enrichState: 'done' }
  const meta = { ...item.meta }
  if (e.title && (meta.autoTitle || !item.title.trim())) {
    patch.title = e.title
    delete meta.autoTitle
  }
  if (e.description && (replace || !item.description)) patch.description = e.description
  const ownPhoto = item.imageUri?.startsWith('local:') && !item.meta.remoteImageUrl
  if (e.imageUrl && (!item.imageUri || (replace && !ownPhoto))) {
    patch.imageUri = e.imageUrl
    patch.imageAspect = e.imageAspect ?? null
    meta.remoteImageUrl = e.imageUrl
  }
  if (e.url && !item.url && e.source !== 'opengraph' && e.source !== 'microlink') patch.url = e.url
  if (e.byline && (replace || !meta.byline)) meta.byline = e.byline
  if (e.siteName && (replace || !meta.siteName)) meta.siteName = e.siteName
  if (e.price && (replace || !meta.price)) meta.price = e.price
  if (e.year && (replace || !meta.year)) meta.year = e.year
  patch.meta = meta
  return patch
}
