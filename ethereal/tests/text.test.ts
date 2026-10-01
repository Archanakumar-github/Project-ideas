import { describe, expect, it } from 'vitest'
import { asIsbn, decodeEntities, extractUrl, hostLabel, stripHtml, titleFromUrl, wordOverlap } from '../src/lib/text'

describe('text helpers', () => {
  it('finds links in pasted text', () => {
    expect(extractUrl('look at https://example.com/a?b=1, lovely')).toBe('https://example.com/a?b=1')
    expect(extractUrl('example.com/thing')).toBe('https://example.com/thing')
    expect(extractUrl('www.etsy.com')).toBe('https://www.etsy.com')
    expect(extractUrl('A cabin by the lake')).toBeNull()
    expect(extractUrl('Dr. Who')).toBeNull()
  })

  it('makes readable placeholder titles from links', () => {
    expect(titleFromUrl('https://www.etsy.com/listing/1234/handmade-brass-telescope?ref=x')).toBe('Handmade brass telescope')
    expect(titleFromUrl('https://www.amazon.com/Celestron-NexStar-8SE/dp/B0000ALKAN')).toBe('Celestron NexStar 8SE')
    expect(titleFromUrl('https://www.ikea.com/')).toBe('Ikea')
    expect(hostLabel('https://www.ikea.com/x')).toBe('ikea.com')
  })

  it('decodes entities and strips markup', () => {
    expect(decodeEntities('&lt;b&gt; &amp; &#8212; &#x2014; &rsquo;')).toBe('<b> & — — ’')
    expect(stripHtml('<p>One</p><p>Two<br>three</p>')).toBe('One\n\nTwo\nthree')
  })

  it('recognises ISBNs', () => {
    expect(asIsbn('ISBN 978-0-8129-6825-5')).toBe('9780812968255')
    expect(asIsbn('0-14-044933-x')).toBe('014044933X')
    expect(asIsbn('1234567890123')).toBeNull()
    expect(asIsbn('Cosmos')).toBeNull()
  })

  it('measures word overlap, ignoring case, accents and filler words', () => {
    expect(wordOverlap('The Île of Skye', 'isle skye ile')).toBe(1)
    expect(wordOverlap('Isle of Skye', 'Skye')).toBe(0.5)
  })
})
