import { describe, expect, it } from 'vitest'
import { cleanIsbn, isValidIsbn10, isValidIsbn13, isbn10to13, looksLikeIsbn, toIsbn13 } from './isbn'

describe('isbn', () => {
  it('cleans separators', () => {
    expect(cleanIsbn('978-0-316-12908-4')).toBe('9780316129084')
    expect(cleanIsbn(' 0-316-12908-x ')).toBe('031612908X')
  })

  it('validates ISBN-10 and ISBN-13 checksums', () => {
    expect(isValidIsbn13('9780316129084')).toBe(true)
    expect(isValidIsbn13('9780316129085')).toBe(false)
    expect(isValidIsbn10('0316129089')).toBe(true)
    expect(isValidIsbn10('080442957X')).toBe(true)
    expect(isValidIsbn10('0316129088')).toBe(false)
  })

  it('upgrades ISBN-10 to ISBN-13', () => {
    expect(isbn10to13('0316129089')).toBe('9780316129084')
    expect(toIsbn13('0-316-12908-9')).toBe('9780316129084')
    expect(toIsbn13('not an isbn')).toBeUndefined()
  })

  it('detects ISBN-like search queries', () => {
    expect(looksLikeIsbn('978-0-316-12908-4')).toBe(true)
    expect(looksLikeIsbn('leviathan wakes')).toBe(false)
    expect(looksLikeIsbn('1984')).toBe(false)
  })
})
