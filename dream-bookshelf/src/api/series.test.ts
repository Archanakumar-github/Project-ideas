import { describe, expect, it } from 'vitest'
import { parseSeriesFromTitle, parseSeriesString, parseVolumeNumber } from './series'

describe('parseVolumeNumber', () => {
  it('reads digits, words and roman numerals', () => {
    expect(parseVolumeNumber('3')).toBe(3)
    expect(parseVolumeNumber('2.5')).toBe(2.5)
    expect(parseVolumeNumber('Seven')).toBe(7)
    expect(parseVolumeNumber('iii')).toBe(3)
    expect(parseVolumeNumber('foo')).toBeUndefined()
  })
})

describe('parseSeriesString', () => {
  it.each([
    ['The Expanse ; 1', 'The Expanse', 1],
    ['The Expanse, #1', 'The Expanse', 1],
    ['Discworld (37)', 'Discworld', 37],
    ['Mistborn, Book 2', 'Mistborn', 2],
    ['A Song of Ice and Fire: Book One', 'A Song of Ice and Fire', 1],
    ['The Stormlight Archive -- bk. 3', 'The Stormlight Archive', 3],
    ['Harry Potter #3', 'Harry Potter', 3],
  ])('%s', (raw, name, index) => {
    expect(parseSeriesString(raw)).toEqual({ name, index })
  })

  it('returns only a name when there is no number', () => {
    expect(parseSeriesString('Penguin Classics')).toEqual({ name: 'Penguin Classics' })
  })
})

describe('parseSeriesFromTitle', () => {
  it('splits Goodreads-style titles', () => {
    expect(parseSeriesFromTitle('Leviathan Wakes (The Expanse, #1)')).toEqual({
      title: 'Leviathan Wakes',
      name: 'The Expanse',
      index: 1,
    })
    expect(parseSeriesFromTitle('The Way of Kings (The Stormlight Archive, Book 1)')).toEqual({
      title: 'The Way of Kings',
      name: 'The Stormlight Archive',
      index: 1,
    })
  })

  it('reads series from a subtitle', () => {
    expect(parseSeriesFromTitle('A Game of Thrones', 'A Song of Ice and Fire, Book One')).toEqual({
      title: 'A Game of Thrones',
      name: 'A Song of Ice and Fire',
      index: 1,
    })
  })

  it('leaves ordinary titles alone', () => {
    expect(parseSeriesFromTitle('Mistborn: The Final Empire')).toEqual({ title: 'Mistborn: The Final Empire' })
    expect(parseSeriesFromTitle('Nineteen Eighty-Four (1984)')).toEqual({ title: 'Nineteen Eighty-Four (1984)' })
    expect(parseSeriesFromTitle('The Odyssey (Penguin Classics)')).toEqual({ title: 'The Odyssey (Penguin Classics)' })
  })
})
