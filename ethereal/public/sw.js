/**
 * Ethereal service worker: makes the web build open with no network.
 *
 * Scope is this folder only (/<repo>/), and every cache it creates or deletes starts with
 * "ethereal-", so it can never affect the other apps published on the same origin.
 * The precache list and version are filled in at build time by scripts/finalize-web.mjs.
 */
const VERSION = '__VERSION__'
const PRECACHE = __PRECACHE__
const SHELL = `ethereal-shell-${VERSION}`
const IMAGES = 'ethereal-images-v1'
const MAX_IMAGES = 300

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll(PRECACHE.map((p) => new Request(p, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('ethereal-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function trimImages() {
  const cache = await caches.open(IMAGES)
  const keys = await cache.keys()
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_IMAGES))) await cache.delete(k)
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  const scope = new URL(self.registration.scope)

  // The app itself: network first (so updates arrive), the cached shell when offline.
  if (req.mode === 'navigate' && url.origin === scope.origin && url.pathname.startsWith(scope.pathname)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(SHELL).then((c) => c.put('./index.html', res.clone()))
          return res
        })
        .catch(() => caches.match('./index.html', { cacheName: SHELL }).then((r) => r || Response.error())),
    )
    return
  }

  // Hashed bundles, fonts, icons, the SQLite engine: cache first.
  if (url.origin === scope.origin && url.pathname.startsWith(scope.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) caches.open(SHELL).then((c) => c.put(req, res.clone()))
            return res
          }),
      ),
    )
    return
  }

  // Pictures fetched from the web for your desires: keep a copy so the board looks the same offline.
  if (req.destination === 'image') {
    event.respondWith(
      caches.open(IMAGES).then((cache) =>
        cache.match(req).then((hit) => {
          const network = fetch(req)
            .then((res) => {
              if (res.ok || res.type === 'opaque') {
                cache.put(req, res.clone()).then(trimImages)
              }
              return res
            })
            .catch(() => hit || Response.error())
          return hit || network
        }),
      ),
    )
  }
})
