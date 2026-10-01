import type { CategoryKind } from './types'

export interface SeedCategory {
  name: string
  kind: CategoryKind
  children: string[]
}

/** Pre-loaded on first launch. Every one of them can be renamed, reordered or deleted. */
export const DEFAULT_TAXONOMY: SeedCategory[] = [
  {
    name: 'Dream Home',
    kind: 'home',
    children: ['Architecture', 'Interior Sanctuary', 'Garden & Patio', 'Reading Nook'],
  },
  {
    name: 'Dream Place',
    kind: 'place',
    children: ['Hidden Valleys', 'Coastal Retreats', 'Stargazing Spots', 'Historic Towns'],
  },
  {
    name: 'Dream Life',
    kind: 'life',
    children: ['Daily Rituals', 'Well-being', 'Creative Pursuits', 'Core Philosophy'],
  },
  {
    name: 'Dream Materials',
    kind: 'materials',
    children: ['Astronomy Equipment', 'Sound & Music Gear', 'Rare Books & Tools', 'Retro Gaming'],
  },
  {
    name: 'Dream Bookshelf',
    kind: 'books',
    children: ['Philosophy', 'Astronomy & Physics', 'Classical Literature', 'Poetry'],
  },
]
