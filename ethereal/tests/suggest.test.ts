import { beforeEach, describe, expect, it } from 'vitest'
import { Repo } from '../src/db/repo'
import type { Category } from '../src/db/types'
import { suggestCategory } from '../src/lib/suggest'
import { pathLabel } from '../src/lib/tree'
import { nodeDriver } from './nodeDriver'

let cats: Category[]
const guess = (title: string, url: string | null = null) => {
  const id = suggestCategory(cats, title, url)
  return id ? pathLabel(cats, id) : null
}

beforeEach(async () => {
  const repo = new Repo(nodeDriver())
  await repo.init()
  cats = await repo.listCategories()
})

describe('suggestCategory', () => {
  it('files obvious desires under the right sub-category', () => {
    expect(guess('Celestron 8" Dobsonian telescope')).toBe('Dream Materials · Astronomy Equipment')
    expect(guess('A-frame cabin in the pines')).toBe('Dream Home · Architecture')
    expect(guess('Lofoten fjord')).toBe('Dream Place · Hidden Valleys')
    expect(guess('Morning tea ritual')).toBe('Dream Life · Daily Rituals')
    expect(guess('Original Game Boy')).toBe('Dream Materials · Retro Gaming')
  })

  it('sends ISBNs and bookshop links to the bookshelf', () => {
    expect(guess('978-0-14-044933-4')).toBe('Dream Bookshelf')
    expect(guess('Meditations by Marcus Aurelius')).toBe('Dream Bookshelf')
    expect(guess('The Little Prince by Antoine de Saint-Exupéry')).toBe('Dream Bookshelf')
    expect(guess('A cabin built by hand')).toBe('Dream Home · Architecture')
    expect(guess('', 'https://www.goodreads.com/book/show/30659.Meditations')).toBe('Dream Bookshelf')
  })

  it('reads words from links too', () => {
    expect(guess('', 'https://shop.example.com/products/walnut-turntable-stand')).toBe('Dream Materials · Sound & Music Gear')
  })

  it('stays quiet when unsure, and copes with renamed or deleted categories', () => {
    expect(guess('Something lovely')).toBeNull()
    const home = cats.find((c) => c.kind === 'home')!
    cats = cats.filter((c) => !(c.parentId === home.id && c.name === 'Architecture'))
    expect(guess('A cottage by the sea wall')).toBe('Dream Home')
    cats = cats.filter((c) => c.kind !== 'home' && c.parentId !== home.id)
    expect(guess('A cottage')).toBeNull()
  })
})
