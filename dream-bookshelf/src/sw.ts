/// <reference lib="WebWorker" />
/**
 * Bibliotheca service worker (built by vite-plugin-pwa's injectManifest strategy).
 *
 *  - Precaches the whole app shell (HTML, JS, CSS, fonts, icons) -> launches with no network.
 *  - SPA navigation fallback to index.html -> deep links work offline.
 *  - Book covers: cache-first (they never change), capped and auto-purged on quota pressure.
 *  - Metadata APIs: network-first with a short timeout, falling back to the last answer, so
 *    searches you've done before still return results in airplane mode.
 *
 * Data itself never goes through here: it lives in IndexedDB, written by the page.
 */
import { createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { cacheNames, clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

const DAY = 24 * 60 * 60

precacheAndRoute(self.__WB_MANIFEST)

// The other apps published on this site live in sub-folders of this worker's scope.
const SIBLING_APPS = /\/(cinematheque|aurafit|ethereal)(\/|$)/

// Remove precaches left by older versions of this worker. (Workbox's cleanupOutdatedCaches()
// deletes every precache whose name *contains* this scope, which would include the sibling
// apps' precaches, since their scopes start with ours. Match our exact scope instead.)
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((n) => n.includes('-precache-') && n.endsWith(self.registration.scope) && n !== cacheNames.precache)
            .map((n) => caches.delete(n)),
        ),
      ),
  )
})

// App-shell routing: every navigation resolves to the precached index.html — except the
// separate apps published alongside at /<repo>/cinematheque/, /<repo>/aurafit/ and /<repo>/ethereal/.
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//, /\.[a-z0-9]+$/i, SIBLING_APPS],
  }),
)

// Cover images from Open Library / Internet Archive / Google Books.
registerRoute(
  ({ request, url }) =>
    request.destination === 'image' &&
    (url.hostname === 'covers.openlibrary.org' ||
      url.hostname.endsWith('.archive.org') ||
      url.hostname === 'archive.org' ||
      url.hostname === 'books.google.com' ||
      url.hostname.endsWith('.googleusercontent.com') ||
      url.hostname === 'books.googleusercontent.com'),
  new CacheFirst({
    cacheName: 'book-covers-v1',
    plugins: [
      // Status 0 = opaque (no-CORS) responses, which <img> requests to these hosts can be.
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 400, maxAgeSeconds: 180 * DAY, purgeOnQuotaError: true }),
    ],
  }),
)

// Metadata APIs.
registerRoute(
  ({ url }) =>
    (url.hostname === 'openlibrary.org' && (url.pathname === '/search.json' || url.pathname.startsWith('/works/'))) ||
    (url.hostname === 'www.googleapis.com' && url.pathname.startsWith('/books/')),
  new NetworkFirst({
    cacheName: 'book-metadata-v1',
    networkTimeoutSeconds: 6,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 150, maxAgeSeconds: 14 * DAY, purgeOnQuotaError: true }),
    ],
  }),
)

// "Update available" flow: the page asks us to activate once the user taps Reload.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') void self.skipWaiting()
})

clientsClaim()
