/** Strips everything but digits and a trailing X. */
export function cleanIsbn(raw: string | undefined | null): string {
  if (!raw) return ''
  return raw.toUpperCase().replace(/[^0-9X]/g, '')
}

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false
  let sum = 0
  for (let i = 0; i < 10; i++) {
    const c = isbn[i]
    const v = c === 'X' ? 10 : Number(c)
    sum += v * (10 - i)
  }
  return sum % 11 === 0
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^97[89]\d{10}$/.test(isbn)) return false
  let sum = 0
  for (let i = 0; i < 13; i++) sum += Number(isbn[i]) * (i % 2 === 0 ? 1 : 3)
  return sum % 10 === 0
}

export function isbn10to13(isbn10: string): string {
  const core = '978' + isbn10.slice(0, 9)
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(core[i]) * (i % 2 === 0 ? 1 : 3)
  return core + ((10 - (sum % 10)) % 10)
}

/** Returns a valid ISBN-13, or undefined when the input isn't a valid ISBN-10/13. */
export function toIsbn13(raw: string | undefined | null): string | undefined {
  const isbn = cleanIsbn(raw)
  if (isValidIsbn13(isbn)) return isbn
  if (isValidIsbn10(isbn)) return isbn10to13(isbn)
  return undefined
}

/** True when a search query is (almost certainly) an ISBN rather than words. */
export function looksLikeIsbn(query: string): boolean {
  if (/[a-wyz]/i.test(query)) return false
  return toIsbn13(query) !== undefined
}

/**
 * Display form. Correct ISBN hyphenation needs the registration-group ranges table, so we
 * only split off the 978/979 prefix rather than guess (wrongly) at the inner groups.
 */
export function formatIsbn(isbn: string | undefined): string {
  if (!isbn) return ''
  return isbn.length === 13 ? `${isbn.slice(0, 3)}-${isbn.slice(3)}` : isbn
}
