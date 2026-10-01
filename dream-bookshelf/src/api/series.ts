/**
 * Heuristics for pulling "series name + volume number" out of the messy strings metadata
 * providers return, e.g.
 *   "Leviathan Wakes (The Expanse, #1)"          (Goodreads-style title)
 *   "The Expanse ; 1" / "Discworld (37)"          (Open Library `series` field)
 *   subtitle "A Song of Ice and Fire, Book One"   (Google Books subtitle)
 */

const WORD_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15,
  first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10,
  i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12,
}

const NUMBER = String.raw`(\d+(?:\.\d+)?|${Object.keys(WORD_NUMBERS).join('|')})`
const MARKER = String.raw`(?:#|no\.?|nr\.?|vol\.?|volume|book|bk\.?|part|pt\.?|tome|band)`
/** Does a string mention a volume marker as a separate word ("Book One", "#2", "Vol. 3")? */
const HAS_MARKER = /(#\s*\d|\b(?:no|nr|vol|volume|book|bk|part|pt|tome|band)\b)/i

export function parseVolumeNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const v = raw.trim().toLowerCase()
  if (/^\d+(\.\d+)?$/.test(v)) return Number(v)
  return WORD_NUMBERS[v]
}

export interface SeriesParse {
  name?: string
  index?: number
}

function tidyName(name: string): string {
  return name
    .replace(/^[\s,;:(\-–—]+|[\s,;:)\-–—]+$/g, '')
    .replace(/\s+series$/i, '')
    .trim()
}

/** Parses a standalone series string ("The Expanse ; 1", "Discworld (37)", "Mistborn, Book 2"). */
export function parseSeriesString(raw: string | undefined): SeriesParse {
  if (!raw) return {}
  const text = raw.trim()
  if (!text) return {}

  const patterns = [
    // "Name, Book 2" / "Name: Volume Three" / "Name #2" / "Name ; 1" / "Name -- bk. 3"
    new RegExp(String.raw`^(.*?)(?:[\s,;:(\-–—]+|^)${MARKER}\s*${NUMBER}\s*\)?\s*$`, 'i'),
    // "Name (37)" / "Name ; 1" / "Name, 4"
    new RegExp(String.raw`^(.*?)\s*(?:\(|;|,|--)\s*(\d+(?:\.\d+)?)\s*\)?\s*$`, 'i'),
  ]
  for (const re of patterns) {
    const m = text.match(re)
    if (m) {
      const name = tidyName(m[1])
      const index = parseVolumeNumber(m[2])
      if (name && index !== undefined) return { name, index }
    }
  }
  return { name: tidyName(text) || undefined }
}

export interface TitleParse extends SeriesParse {
  title: string
}

/** Splits "Leviathan Wakes (The Expanse, #1)" into a clean title + series info. */
export function parseSeriesFromTitle(rawTitle: string, subtitle?: string): TitleParse {
  const title = rawTitle.trim()

  // Trailing parenthetical that contains a volume marker or "#".
  const paren = title.match(/^(.*?)\s*\(([^()]+)\)\s*$/)
  if (paren) {
    const inner = parseSeriesString(paren[2])
    if (inner.name && inner.index !== undefined) {
      return { title: paren[1].trim(), name: inner.name, index: inner.index }
    }
  }

  // Subtitle like "A Song of Ice and Fire, Book One" or "The Stormlight Archive: Book 1".
  if (subtitle) {
    const s = parseSeriesString(subtitle)
    if (s.name && s.index !== undefined && HAS_MARKER.test(subtitle)) {
      return { title, name: s.name, index: s.index }
    }
  }

  // "Mistborn: The Final Empire" has no number; "Dune Messiah: Dune Chronicles, Book 2" does.
  const colon = title.match(/^(.*?):\s*(.+)$/)
  if (colon) {
    const s = parseSeriesString(colon[2])
    if (s.name && s.index !== undefined && HAS_MARKER.test(colon[2])) {
      return { title: colon[1].trim(), name: s.name, index: s.index }
    }
  }

  return { title }
}
