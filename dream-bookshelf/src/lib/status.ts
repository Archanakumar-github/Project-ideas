import type { BookStatus, SeriesStatus } from '../db/types'

export interface StatusMeta {
  label: string
  short: string
  /** CSS colour token (also used for glows / progress segments). */
  color: string
  /** Tailwind classes for a soft tinted pill. */
  pill: string
  /** Tailwind text colour. */
  text: string
}

export const BOOK_STATUS_META: Record<BookStatus, StatusMeta> = {
  'want-to-read': {
    label: 'Want to Read',
    short: 'To Read',
    color: 'var(--color-sage)',
    pill: 'bg-sage/15 text-sage ring-1 ring-sage/30',
    text: 'text-sage',
  },
  'want-to-buy': {
    label: 'Want to Buy',
    short: 'To Buy',
    color: 'var(--color-terracotta)',
    pill: 'bg-terracotta/15 text-terracotta ring-1 ring-terracotta/30',
    text: 'text-terracotta',
  },
  owned: {
    label: 'Owned',
    short: 'Owned',
    color: 'var(--color-amber)',
    pill: 'bg-amber/15 text-amber ring-1 ring-amber/30',
    text: 'text-amber',
  },
}

export const SERIES_STATUS_META: Record<SeriesStatus, StatusMeta> = {
  'want-to-read': BOOK_STATUS_META['want-to-read'],
  'want-to-buy': BOOK_STATUS_META['want-to-buy'],
  collecting: {
    label: 'Collecting',
    short: 'Collecting',
    color: 'var(--color-amber-glow)',
    pill: 'bg-amber-glow/15 text-amber-glow ring-1 ring-amber-glow/30',
    text: 'text-amber-glow',
  },
  complete: {
    label: 'Complete',
    short: 'Complete',
    color: 'var(--color-amber)',
    pill: 'bg-amber/15 text-amber ring-1 ring-amber/30',
    text: 'text-amber',
  },
}
