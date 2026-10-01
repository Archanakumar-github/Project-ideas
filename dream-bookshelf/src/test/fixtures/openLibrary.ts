import type { OpenLibrarySearchResponse } from '../../api/openLibrary'

/** Shape of https://openlibrary.org/search.json?q=leviathan+wakes&fields=... */
export const olLeviathan: OpenLibrarySearchResponse = {
  numFound: 2,
  docs: [
    {
      key: '/works/OL15833435W',
      title: 'Leviathan Wakes',
      author_name: ['James S. A. Corey'],
      first_publish_year: 2011,
      number_of_pages_median: 592,
      isbn: ['8490701591', '9780316129084', '0316129089', '9788490701591'],
      cover_i: 6655616,
      subject: ['Science fiction', 'Space warfare', 'Science fiction'],
      series: ['The Expanse ; 1'],
    },
    {
      key: '/works/OL20030493W',
      title: 'Leviathan Wakes (The Expanse, #1) Collector edition',
      author_name: ['James S. A. Corey'],
    },
  ],
}
