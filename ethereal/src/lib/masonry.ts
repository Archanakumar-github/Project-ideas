/** Masonry layout: each card goes into whichever column is currently shortest. Pure. */
import type { Item } from '../db/types'

export const GRID_GAP = 12
export const GRID_PADDING = 16

export function columnsFor(width: number): number {
  if (width >= 1100) return 4
  if (width >= 700) return 3
  return 2
}

/** Images are laid out at their own shape, within calm limits (no slivers, no towers). */
export function clampAspect(aspect: number | null | undefined): number {
  if (!aspect || !Number.isFinite(aspect)) return 1
  return Math.min(1.6, Math.max(0.62, aspect))
}

/** A good-enough height estimate before anything has rendered. */
export function estimateHeight(item: Pick<Item, 'title' | 'imageUri' | 'imageAspect' | 'notes' | 'meta'>, colWidth: number): number {
  const charsPerLine = Math.max(10, Math.floor((colWidth - 24) / 8.2))
  const titleLines = Math.min(3, Math.ceil(item.title.length / charsPerLine))
  if (item.imageUri) {
    return colWidth / clampAspect(item.imageAspect) + 18 + titleLines * 20 + (item.meta.byline ? 18 : 0)
  }
  const serifChars = Math.max(8, Math.floor((colWidth - 32) / 10.5))
  const serifLines = Math.min(5, Math.ceil(item.title.length / serifChars))
  const noteLines = item.notes ? Math.min(3, Math.ceil(item.notes.length / charsPerLine)) : 0
  return 64 + serifLines * 26 + noteLines * 18
}

export function layoutMasonry<T>(items: T[], columns: number, height: (item: T) => number): T[][] {
  const cols: T[][] = Array.from({ length: Math.max(1, columns) }, () => [])
  const heights = cols.map(() => 0)
  for (const item of items) {
    let target = 0
    for (let c = 1; c < heights.length; c++) if (heights[c] < heights[target] - 1) target = c
    cols[target].push(item)
    heights[target] += height(item) + GRID_GAP
  }
  return cols
}
