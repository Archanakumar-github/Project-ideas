/**
 * Link previews from a page's own metadata: Open Graph, Twitter cards, JSON-LD (Product, Book,
 * Place…) and plain <title>/<meta name=description>, in that order of preference.
 *
 * iOS and Android fetch the page directly. Browsers block reading other sites' HTML (CORS), so
 * the web build falls back to Microlink's free preview API, which receives only the link.
 */
import { fetchJson, fetchWithTimeout, type FetchOptions } from './http'
import type { Enrichment } from './types'
import { decodeEntities, stripHtml } from '../lib/text'

const MAX_HTML = 600_000

function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([a-zA-Z_:.-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g
  let m: RegExpExecArray | null
  while ((m = re.exec(tag))) out[m[1].toLowerCase()] = decodeEntities(m[3] ?? m[4] ?? m[5] ?? '')
  return out
}

function absolute(url: string | undefined, base: string): string | undefined {
  if (!url) return undefined
  try {
    const abs = new URL(url.trim(), base)
    if (abs.protocol === 'http:') abs.protocol = 'https:'
    return abs.protocol === 'https:' ? abs.toString() : undefined
  } catch {
    return undefined
  }
}

type JsonLd = Record<string, unknown>

function jsonLdNodes(html: string): JsonLd[] {
  const out: JsonLd[] = []
  const re = /<script[^>]+type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html))) {
    try {
      const data = JSON.parse(m[1].trim()) as unknown
      const stack: unknown[] = [data]
      while (stack.length) {
        const node = stack.pop()
        if (Array.isArray(node)) stack.push(...node)
        else if (node && typeof node === 'object') {
          out.push(node as JsonLd)
          const graph = (node as JsonLd)['@graph']
          if (graph) stack.push(graph)
        }
      }
    } catch {
      // Malformed JSON-LD is common; ignore it.
    }
  }
  return out
}

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)

function firstImage(v: unknown): string | undefined {
  if (typeof v === 'string') return v
  if (Array.isArray(v)) return firstImage(v[0])
  if (v && typeof v === 'object') return str((v as JsonLd).url) ?? str((v as JsonLd).contentUrl)
  return undefined
}

function names(v: unknown): string | undefined {
  const list = (Array.isArray(v) ? v : [v])
    .map((a) => (typeof a === 'string' ? a : a && typeof a === 'object' ? str((a as JsonLd).name) : undefined))
    .filter((a): a is string => !!a)
  return list.length ? list.join(', ') : undefined
}

export function formatPrice(amount: unknown, currency: unknown): string | undefined {
  const n = typeof amount === 'number' ? amount : typeof amount === 'string' ? Number.parseFloat(amount) : NaN
  if (!Number.isFinite(n) || n <= 0) return undefined
  const cur = typeof currency === 'string' && /^[A-Z]{3}$/.test(currency) ? currency : undefined
  if (!cur) return n.toFixed(2).replace(/\.00$/, '')
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: cur }).format(n)
  } catch {
    return `${cur} ${n}`
  }
}

/** Pure: turns a page's HTML into an Enrichment. */
export function parseOpenGraph(html: string, pageUrl: string): Enrichment {
  const head = html.slice(0, MAX_HTML)
  const meta: Record<string, string> = {}
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const a = attrs(tag)
    const key = (a.property ?? a.name ?? a.itemprop ?? '').toLowerCase()
    if (key && a.content && !(key in meta)) meta[key] = a.content.trim()
  }
  let linkImage: string | undefined
  for (const tag of head.match(/<link\b[^>]*>/gi) ?? []) {
    const a = attrs(tag)
    if (/\bimage_src\b/i.test(a.rel ?? '') && a.href) linkImage = a.href
  }
  const titleTag = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]

  const ld = jsonLdNodes(head)
  const typed = (t: string) =>
    ld.find((n) => {
      const type = n['@type']
      return Array.isArray(type) ? type.includes(t) : type === t
    })
  const product = typed('Product') ?? typed('Book') ?? typed('Place') ?? typed('TouristAttraction')
  const offers = product?.offers
  const offer = (Array.isArray(offers) ? offers[0] : offers) as JsonLd | undefined

  const title =
    meta['og:title'] ?? meta['twitter:title'] ?? str(product?.name) ?? (titleTag ? stripHtml(titleTag) : undefined)
  const description =
    meta['og:description'] ?? meta['twitter:description'] ?? str(product?.description) ?? meta.description
  const image =
    meta['og:image:secure_url'] ??
    meta['og:image'] ??
    meta['og:image:url'] ??
    meta['twitter:image'] ??
    meta['twitter:image:src'] ??
    firstImage(product?.image) ??
    linkImage
  const width = Number(meta['og:image:width'])
  const height = Number(meta['og:image:height'])
  const price =
    formatPrice(meta['product:price:amount'] ?? meta['og:price:amount'], meta['product:price:currency'] ?? meta['og:price:currency']) ??
    formatPrice(offer?.price ?? offer?.lowPrice, offer?.priceCurrency)

  return {
    source: 'opengraph',
    title: title ? decodeEntities(title).replace(/\s+/g, ' ').trim() : undefined,
    description: description ? stripHtml(description) : undefined,
    imageUrl: absolute(image, pageUrl),
    imageAspect: width > 0 && height > 0 ? width / height : undefined,
    siteName: meta['og:site_name'] ?? meta['application-name'],
    byline: names(product?.author) ?? names(product?.brand) ?? meta.author,
    price,
    url: absolute(meta['og:url'], pageUrl) ?? pageUrl,
  }
}

interface MicrolinkResponse {
  status: string
  data?: {
    title?: string | null
    description?: string | null
    publisher?: string | null
    author?: string | null
    url?: string | null
    image?: { url?: string; width?: number; height?: number } | null
  }
}

export function mapMicrolink(res: MicrolinkResponse, pageUrl: string): Enrichment | null {
  const d = res.data
  if (res.status !== 'success' || !d) return null
  const img = d.image
  return {
    source: 'microlink',
    title: d.title ?? undefined,
    description: d.description ?? undefined,
    imageUrl: absolute(img?.url, pageUrl),
    imageAspect: img?.width && img?.height ? img.width / img.height : undefined,
    siteName: d.publisher ?? undefined,
    byline: d.author ?? undefined,
    url: d.url ?? pageUrl,
  }
}

export async function fetchOpenGraph(
  pageUrl: string,
  { viaProxy = false, ...opts }: FetchOptions & { viaProxy?: boolean } = {},
): Promise<Enrichment | null> {
  if (viaProxy) {
    const res = await fetchJson<MicrolinkResponse>(
      `https://api.microlink.io/?url=${encodeURIComponent(pageUrl)}`,
      { timeoutMs: 10_000, ...opts },
    )
    return mapMicrolink(res, pageUrl)
  }
  const res = await fetchWithTimeout(pageUrl, { timeoutMs: 10_000, accept: 'text/html,application/xhtml+xml', ...opts })
  const type = res.headers.get('content-type') ?? ''
  if (type.startsWith('image/')) return { source: 'opengraph', imageUrl: pageUrl, url: pageUrl }
  const html = await res.text()
  return parseOpenGraph(html, res.url || pageUrl)
}
