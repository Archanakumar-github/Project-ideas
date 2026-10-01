export type ClassValue = string | false | null | undefined | 0

/** Tiny `clsx`: joins truthy class names. */
export function cx(...values: ClassValue[]): string {
  let out = ''
  for (const v of values) if (v) out += (out ? ' ' : '') + v
  return out
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for iOS < 15.4.
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

/** Lowercase, strip diacritics & punctuation, collapse whitespace — for matching and search. */
export function normalize(text: string | undefined | null): string {
  if (!text) return ''
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** Normalized title without leading articles, for sorting and duplicate checks. */
export function titleKey(title: string): string {
  return normalize(title).replace(/^(the|a|an) /, '')
}

export function uniq<T>(items: Iterable<T>): T[] {
  return Array.from(new Set(items))
}

/** Case-insensitive de-duplication that keeps the first spelling seen. */
export function uniqText(items: Iterable<string>): string[] {
  const seen = new Map<string, string>()
  for (const raw of items) {
    const value = raw.trim()
    if (!value) continue
    const key = value.toLowerCase()
    if (!seen.has(key)) seen.set(key, value)
  }
  return Array.from(seen.values())
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n))
}

/** Stable 32-bit string hash (FNV-1a) used for deterministic placeholder colours. */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

export function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number) {
  let t: ReturnType<typeof setTimeout> | undefined
  const debounced = (...args: A) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
  debounced.cancel = () => t && clearTimeout(t)
  return debounced
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`
}

const priceFormatters = new Map<string, Intl.NumberFormat>()
export function formatPrice(amount: number | undefined, currency = 'USD'): string {
  if (amount === undefined || Number.isNaN(amount)) return ''
  let f = priceFormatters.get(currency)
  if (!f) {
    try {
      f = new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 })
    } catch {
      f = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
    }
    priceFormatters.set(currency, f)
  }
  return f.format(amount)
}

export function formatAuthors(authors: string[] | undefined, max = 2): string {
  if (!authors || authors.length === 0) return 'Unknown author'
  if (authors.length <= max) return authors.join(' & ')
  return `${authors.slice(0, max).join(', ')} +${authors.length - max}`
}

export function relativeTime(ts: number, now = Date.now()): string {
  const diff = Math.round((ts - now) / 1000)
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })
  const abs = Math.abs(diff)
  if (abs < 60) return rtf.format(diff, 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  return rtf.format(Math.round(diff / 86400), 'day')
}

/** Parses user-entered numbers like "12,99" or " 320 " -> number | undefined. */
export function parseNumber(input: string | number | undefined | null): number | undefined {
  if (input === undefined || input === null) return undefined
  if (typeof input === 'number') return Number.isFinite(input) ? input : undefined
  const cleaned = input.trim().replace(/[^\d.,-]/g, '').replace(',', '.')
  if (!cleaned) return undefined
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : undefined
}

export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
