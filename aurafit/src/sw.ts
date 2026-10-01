/// <reference lib="WebWorker" />
/**
 * AuraFit service worker (vite-plugin-pwa injectManifest).
 *
 *  - Precaches the whole app (HTML, JS, CSS, icons, every lazy chunk) → launches offline.
 *  - SPA navigation fallback to index.html.
 *  - Exercise images (wger) and recipe photos (TheMealDB): cache-first, capped.
 *  - Nutrition / recipe / exercise JSON APIs are deliberately NOT cached here: what you
 *    search for stays out of plain-text caches. Foods you pick are saved, encrypted, in the
 *    app's own database instead.
 *  - Your data never passes through the service worker; it lives encrypted in IndexedDB.
 */
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<{ url: string; revision: string | null }> }

const DAY = 24 * 60 * 60

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html'), { denylist: [/\.[a-z0-9]+$/i] }))

registerRoute(
  ({ request, url }) => request.destination === 'image' && (url.hostname === 'wger.de' || url.hostname === 'www.themealdb.com'),
  new CacheFirst({
    cacheName: 'aurafit-images-v1',
    plugins: [new CacheableResponsePlugin({ statuses: [0, 200] }), new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 90 * DAY, purgeOnQuotaError: true })],
  }),
)

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') void self.skipWaiting()
})

clientsClaim()
