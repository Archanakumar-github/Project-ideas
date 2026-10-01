// exodus. — offline support.
// App code (HTML/JS/CSS) is network-first with a short timeout, so updates arrive on their own
// while the saved copy keeps the app working offline. Fonts and icons are cache-first.
const CACHE = 'exodus-app';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/dom.js',
  './js/model.js',
  './js/vault.js',
  './js/starter.js',
  './js/lookup.js',
  './fonts/inter-latin-wght-normal.woff2',
  './fonts/jetbrains-mono-latin-wght-normal.woff2',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];
const NETWORK_TIMEOUT = 2500;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('exodus-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function fromCache(req) {
  const cache = await caches.open(CACHE);
  return (await cache.match(req, { ignoreSearch: true })) || (req.mode === 'navigate' ? cache.match('./index.html') : undefined);
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  const network = fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_TIMEOUT));
  const winner = await Promise.race([network.catch(() => undefined), timeout]);
  if (winner) return winner;
  const cached = await fromCache(req);
  if (cached) return cached;
  return network.catch(() => Response.error());
}

async function cacheFirst(req) {
  const cached = await fromCache(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const isCode = req.mode === 'navigate' || /\.(html|js|css|webmanifest)$/.test(url.pathname) || url.pathname.endsWith('/');
  event.respondWith((isCode ? networkFirst(req) : cacheFirst(req)).catch(() => fromCache(req).then((r) => r || Response.error())));
});
