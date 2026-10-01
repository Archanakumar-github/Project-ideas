import type { GoogleBooksResponse } from '../../api/googleBooks'

/** Shape of https://www.googleapis.com/books/v1/volumes?q=isbn:9780316129084&fields=... */
export const gbLeviathan: GoogleBooksResponse = {
  items: [
    {
      id: 'yud-foNMy4wC',
      volumeInfo: {
        title: 'Leviathan Wakes',
        subtitle: 'Book 1 of the Expanse (now a Prime Original series)',
        authors: ['James S. A. Corey'],
        publishedDate: '2011-06-02',
        description: '<p>Humanity has colonized the solar system&#39;s planets.</p><p>Jim Holden&apos;s ship&nbsp;finds a derelict.</p>',
        industryIdentifiers: [
          { type: 'ISBN_10', identifier: '0316129089' },
          { type: 'ISBN_13', identifier: '9780316129084' },
        ],
        pageCount: 582,
        categories: ['Fiction'],
        imageLinks: {
          smallThumbnail: 'http://books.google.com/books/content?id=yud-foNMy4wC&printsec=frontcover&img=1&zoom=5&edge=curl&source=gbs_api',
          thumbnail: 'http://books.google.com/books/content?id=yud-foNMy4wC&printsec=frontcover&img=1&zoom=1&edge=curl&source=gbs_api',
        },
        infoLink: 'https://books.google.com/books?id=yud-foNMy4wC',
        seriesInfo: { bookDisplayNumber: '1' },
      },
      saleInfo: {
        listPrice: { amount: 18.99, currencyCode: 'USD' },
        retailPrice: { amount: 9.99, currencyCode: 'USD' },
        buyLink: 'https://play.google.com/store/books/details?id=yud-foNMy4wC',
      },
    },
  ],
}
