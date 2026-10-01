/**
 * Intelligent defaults for the add flow: guesses where a new desire belongs from its words or
 * link. It only pre-selects a pill; the user can always tap another. Pure.
 */
import type { Category, CategoryKind } from '../db/types'
import { asIsbn } from './text'

interface Rule {
  kind: CategoryKind
  /** Seeded sub-category name to prefer (ignored if the user renamed or removed it). */
  sub?: string
  re: RegExp
}

/** "Meditations by Marcus Aurelius": a title followed by a capitalised name reads as a book. */
const TITLE_BY_AUTHOR =
  /\S\s+by\s+\p{Lu}[\p{L}.'-]*(\s+(\p{Lu}[\p{L}.'-]*|de|da|del|di|du|van|von|der|den|le|la|al|bin|ibn))*\s*$/u

const BOOK_HOSTS = /(goodreads|openlibrary|books\.google|bookshop|abebooks|waterstones|barnesandnoble|blackwells|penguin|bookdepository|thriftbooks)\./i

const RULES: Rule[] = [
  { kind: 'materials', sub: 'Astronomy Equipment', re: /\b(telescope|eyepiece|refractor|reflector|dobsonian|binocular|star ?tracker|astro)/i },
  { kind: 'materials', sub: 'Sound & Music Gear', re: /\b(vinyl|turntable|record player|guitar|synth|piano|headphones?|speakers?|amplifier|cello|violin|ukulele)/i },
  { kind: 'materials', sub: 'Retro Gaming', re: /\b(game ?boy|nintendo|sega|snes|n64|playstation|arcade|console|retro gam|famicom|atari)/i },
  { kind: 'materials', sub: 'Rare Books & Tools', re: /\b(fountain pen|first edition|antique|typewriter|letterpress|calligraphy|loupe|compass|chisel)/i },
  { kind: 'place', sub: 'Stargazing Spots', re: /\b(dark[- ]sky|stargaz|observatory|aurora|northern lights|milky way)/i },
  { kind: 'place', sub: 'Coastal Retreats', re: /\b(beach|coast|island|isle|bay|cove|seaside|lighthouse|shore)/i },
  { kind: 'place', sub: 'Hidden Valleys', re: /\b(valley|fjord|glen|canyon|gorge|mountain|alps|highlands|lake)/i },
  { kind: 'place', sub: 'Historic Towns', re: /\b(old town|village|medieval|historic|citadel|abbey|cathedral|castle)/i },
  { kind: 'home', sub: 'Reading Nook', re: /\b(reading nook|window seat|armchair|bookcase|library ladder|reading lamp)/i },
  { kind: 'home', sub: 'Garden & Patio', re: /\b(garden|patio|greenhouse|courtyard|pergola|terrace|orchard|plants?)\b/i },
  { kind: 'home', sub: 'Interior Sanctuary', re: /\b(sofa|rug|lamp|chandelier|bed|linen|interior|fireplace|ceramic|candle)/i },
  { kind: 'home', sub: 'Architecture', re: /\b(cabin|cottage|house|villa|architect|a-frame|loft|barn|tower)/i },
  { kind: 'life', sub: 'Core Philosophy', re: /\b(stoic|philosoph|virtue|meaning of|principle)/i },
  { kind: 'life', sub: 'Well-being', re: /\b(yoga|meditat|sleep|sauna|run|swim|health|breath)/i },
  { kind: 'life', sub: 'Creative Pursuits', re: /\b(paint|sketch|pottery|write a|learn|compose|photograph|knit|draw)/i },
  { kind: 'life', sub: 'Daily Rituals', re: /\b(morning|ritual|tea|coffee|journal|walk|evening|routine)/i },
]

/** Best guess for a title and/or link, or null when nothing fits clearly. */
export function suggestCategory(categories: Category[], title: string, url: string | null): string | null {
  const roots = categories.filter((c) => c.parentId === null)
  const byKind = (kind: CategoryKind) => roots.find((c) => c.kind === kind)
  const sub = (root: Category, name?: string) =>
    (name && categories.find((c) => c.parentId === root.id && c.name.toLowerCase() === name.toLowerCase())) || root

  if (asIsbn(title) || TITLE_BY_AUTHOR.test(title.trim()) || (url && BOOK_HOSTS.test(url))) {
    const books = byKind('books')
    if (books) return books.id
  }
  const haystack = `${title} ${url ? decodeURIComponent(url).replace(/[-_/]+/g, ' ') : ''}`
  for (const rule of RULES) {
    if (!rule.re.test(haystack)) continue
    const root = byKind(rule.kind)
    if (root) return sub(root, rule.sub).id
  }
  return null
}
