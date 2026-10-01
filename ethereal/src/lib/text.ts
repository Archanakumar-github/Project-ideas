/** Small text helpers shared by enrichment and the add flow. Pure, no React Native imports. */

const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+/i
const BARE_DOMAIN_RE = /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:[/?#][^\s]*)?$/i

/** The first link in a piece of text, or a bare "example.com/thing" typed on its own. */
export function extractUrl(text: string): string | null {
  const trimmed = text.trim()
  const match = trimmed.match(URL_RE)
  if (match) return match[0].replace(/[),.;:!?\]]+$/, '')
  if (BARE_DOMAIN_RE.test(trimmed) && !trimmed.includes(' ')) return `https://${trimmed}`
  return null
}

export function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** A readable placeholder title from a link, used until the page's own title arrives. */
export function titleFromUrl(url: string): string {
  try {
    const u = new URL(url)
    const segments = u.pathname
      .split('/')
      .map((s) => safeDecode(s).replace(/\.(html?|php|aspx?)$/i, ''))
      .filter((s) => /[a-z]{3,}/i.test(s) && !/^[A-Z0-9]{8,}$/.test(s))
      .filter((s) => !/^(dp|p|product|products|listing|item|items|gp|shop|store|en|en-us|us)$/i.test(s))
    // The slug with the most words is almost always the product or article name.
    const wordsIn = (s: string) => s.split(/[-_+\s]+/).filter((w) => /[a-z]/i.test(w)).length
    const slug = segments.reduce<string | undefined>((best, s) => (!best || wordsIn(s) >= wordsIn(best) ? s : best), undefined)
    if (slug && slug.length > 3) {
      const words = slug.replace(/[-_+]+/g, ' ').replace(/\s+/g, ' ').trim()
      if (words.length >= 4) return capitalize(truncate(words, 80))
    }
    const host = hostLabel(url).split('.')
    return capitalize(host.length > 1 ? host[host.length - 2] : host[0])
  } catch {
    return url
  }
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

export function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
}

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? Number.parseInt(e.slice(2), 16) : Number(e.slice(1))
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m
    }
    return ENTITIES[e.toLowerCase()] ?? m
  })
}

export function stripHtml(html: string | undefined | null): string {
  if (!html) return ''
  return decodeEntities(
    html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\b(the|a|an|of|and)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Share of the query's words found in the candidate (0..1). */
export function wordOverlap(query: string, candidate: string): number {
  const q = normalizeForMatch(query).split(' ').filter(Boolean)
  if (!q.length) return 0
  const c = new Set(normalizeForMatch(candidate).split(' '))
  return q.filter((w) => c.has(w)).length / q.length
}

/** ISBN-10 or ISBN-13 typed with or without hyphens. */
export function asIsbn(text: string): string | null {
  const digits = text.replace(/^isbn[:\s]*/i, '').replace(/[\s-]/g, '')
  if (/^\d{13}$/.test(digits) && /^97[89]/.test(digits)) return digits
  if (/^\d{9}[\dX]$/i.test(digits)) return digits.toUpperCase()
  return null
}

export function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s
}
