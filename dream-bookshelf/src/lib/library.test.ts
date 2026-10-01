import { describe, expect, it } from 'vitest'
import type { Book, Series } from '../db/types'
import { filterBooks, findDuplicate, searchLocal, seriesStats, sortBooks, wishlistTotals } from './library'

let n = 0
function book(p: Partial<Book>): Book {
  n++
  return {
    id: `b${n}`,
    title: `Book ${n}`,
    authors: [],
    status: 'want-to-read',
    shelfIds: [],
    source: 'manual',
    metadataState: 'complete',
    createdAt: n,
    updatedAt: n,
    ...p,
  }
}

const dune = book({ title: 'Dune', authors: ['Frank Herbert'], status: 'owned', publishYear: 1965, categoryId: 'scifi', price: 10 })
const hail = book({ title: 'Project Hail Mary', authors: ['Andy Weir'], status: 'want-to-buy', publishYear: 2021, categoryId: 'scifi', subCategoryId: 'hard', price: 18.5, currency: 'USD', shelfIds: ['top'] })
const secret = book({ title: 'The Secret History', authors: ['Donna Tartt'], status: 'want-to-buy', price: 9, currency: 'EUR', notes: 'recommended by Sam' })
const vol2 = book({ title: "Caliban's War", authors: ['James S. A. Corey'], seriesId: 's1', seriesIndex: 2 })
const vol1 = book({ title: 'Leviathan Wakes', authors: ['James S. A. Corey'], seriesId: 's1', seriesIndex: 1, status: 'owned' })
const all = [dune, hail, secret, vol2, vol1]
const expanse: Series = { id: 's1', title: 'The Expanse', authors: [], status: 'collecting', shelfIds: [], createdAt: 0, updatedAt: 0, totalVolumes: 4 }

describe('filterBooks', () => {
  it('combines status, category, sub-category and shelf filters', () => {
    expect(filterBooks(all, { status: 'want-to-buy' }).map((b) => b.title)).toEqual(['Project Hail Mary', 'The Secret History'])
    expect(filterBooks(all, { status: 'all', categoryId: 'scifi' })).toHaveLength(2)
    expect(filterBooks(all, { status: 'all', categoryId: 'scifi', subCategoryId: 'hard' })).toEqual([hail])
    expect(filterBooks(all, { status: 'all', shelfId: 'top' })).toEqual([hail])
    expect(filterBooks(all, { status: 'all' }, { showSeriesVolumes: false })).toHaveLength(3)
  })
})

describe('sortBooks', () => {
  it('sorts by title ignoring leading articles', () => {
    expect(sortBooks(all, 'title').map((b) => b.title)).toEqual([
      "Caliban's War",
      'Dune',
      'Leviathan Wakes',
      'Project Hail Mary',
      'The Secret History',
    ])
  })
  it('sorts by author last name, newest year, price, and series order', () => {
    expect(sortBooks([secret, dune, hail], 'author').map((b) => b.authors[0])).toEqual(['Frank Herbert', 'Donna Tartt', 'Andy Weir'])
    expect(sortBooks(all, 'year')[0]).toBe(hail)
    expect(sortBooks(all, 'price').map((b) => b.price)).toEqual([9, 10, 18.5, undefined, undefined])
    const bySeries = sortBooks(all, 'series', new Map([['s1', expanse]]))
    expect(bySeries.slice(0, 2)).toEqual([vol1, vol2])
  })
  it('defaults to most recently added', () => {
    expect(sortBooks(all, 'recent')[0]).toBe(vol1)
  })
})

describe('searchLocal', () => {
  const ctx = { categoriesById: new Map(), shelvesById: new Map(), seriesById: new Map([['s1', expanse]]) }
  it('matches titles, authors, notes and series names, ranking title hits first', () => {
    expect(searchLocal(all, 'hail', ctx)).toEqual([hail])
    expect(searchLocal(all, 'tartt', ctx)).toEqual([secret])
    expect(searchLocal(all, 'sam', ctx)).toEqual([secret])
    expect(searchLocal(all, 'expanse', ctx)).toHaveLength(2)
    expect(searchLocal(all, 'dune herbert', ctx)).toEqual([dune])
    expect(searchLocal(all, '', ctx)).toEqual([])
  })
})

describe('seriesStats', () => {
  it('counts statuses and finds gaps up to the planned total', () => {
    expect(seriesStats(expanse, [vol1, vol2])).toEqual({
      total: 4,
      added: 2,
      owned: 1,
      wantToRead: 1,
      wantToBuy: 0,
      missing: [3, 4],
    })
  })
})

describe('wishlistTotals / findDuplicate', () => {
  it('sums want-to-buy prices per currency', () => {
    expect(wishlistTotals(all)).toEqual([
      { currency: 'USD', amount: 18.5, count: 1 },
      { currency: 'EUR', amount: 9, count: 1 },
    ])
  })
  it('detects duplicates by ISBN or title + author', () => {
    expect(findDuplicate(all, { title: 'the secret history', authors: ['D. Tartt'] })).toBe(secret)
    expect(findDuplicate(all, { title: 'Dune', authors: ['Someone Else'] })).toBeUndefined()
  })
})
