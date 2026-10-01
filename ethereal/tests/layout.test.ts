import { describe, expect, it } from 'vitest'
import { clampAspect, columnsFor, estimateHeight, layoutMasonry } from '../src/lib/masonry'
import { greetingFor, QUOTES, quoteFor } from '../src/lib/greeting'

describe('masonry', () => {
  it('fills the shortest column, keeping order within columns', () => {
    const heights: Record<string, number> = { a: 300, b: 100, c: 100, d: 100, e: 50 }
    const cols = layoutMasonry(Object.keys(heights), 2, (k) => heights[k])
    expect(cols).toEqual([
      ['a', 'e'],
      ['b', 'c', 'd'],
    ])
  })

  it('picks a column count for the screen', () => {
    expect(columnsFor(390)).toBe(2)
    expect(columnsFor(820)).toBe(3)
    expect(columnsFor(1280)).toBe(4)
  })

  it('clamps extreme image shapes and estimates heights', () => {
    expect(clampAspect(10)).toBe(1.6)
    expect(clampAspect(0.1)).toBe(0.62)
    expect(clampAspect(null)).toBe(1)
    const tall = estimateHeight({ title: 'x', imageUri: 'local:a', imageAspect: 0.5, notes: '', meta: {} }, 170)
    const wide = estimateHeight({ title: 'x', imageUri: 'local:a', imageAspect: 2, notes: '', meta: {} }, 170)
    expect(tall).toBeGreaterThan(wide)
    const text = estimateHeight({ title: 'A slow morning ritual with tea', imageUri: null, imageAspect: null, notes: 'n', meta: {} }, 170)
    expect(text).toBeGreaterThan(100)
  })
})

describe('greeting', () => {
  it('follows the time of day', () => {
    const at = (h: number) => greetingFor(new Date(2026, 9, 1, h)).title
    expect(at(7)).toBe('Quiet morning')
    expect(at(14)).toBe('Soft afternoon')
    expect(at(19)).toBe('Gentle evening')
    expect(at(23)).toBe('Still night')
    expect(at(3)).toBe('Still night')
  })

  it('keeps one quote per day and lets a tap step through them', () => {
    const d = new Date(2026, 9, 1, 8)
    expect(quoteFor(d)).toBe(quoteFor(new Date(2026, 9, 1, 22)))
    expect(quoteFor(d, 1)).not.toBe(quoteFor(d))
    expect(quoteFor(d, QUOTES.length)).toBe(quoteFor(d))
    expect(quoteFor(d, -1)).toBe(quoteFor(d, QUOTES.length - 1))
  })
})
