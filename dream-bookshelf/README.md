# Bibliotheca

A private, offline-first Progressive Web App for keeping track of the books and series you
**want to read** and **want to buy**. It's tuned for Safari and Chrome on iOS, installs to the
Home Screen, and keeps every byte of your library on your device.

**[Open the app](https://archanakumar-github.github.io/bibliotheca/)**

> **Warm Sanctuary** theme: deep espresso canvas, aged-paper cards, cream type, an amber glow
> for actions, sage for *Want to Read* and terracotta for *Want to Buy*.

## Features

| | |
|---|---|
| **Quick Search Add** | Tap **+** and the keyboard is already up. Type a title, author or ISBN, tap a result to preview it, pick a status and category, then save. Status is remembered and the category is suggested from the book's subjects, so most adds are two taps. |
| **Manual add / edit** | A short form (cover, title, author, status, category) with *More details* for series, ISBN lookup, year, pages, price, link, shelves and notes. Authors and series names are auto-suggested. |
| **Series** | Series hold ordered volumes (decimals such as #2.5 work). Each series shows a progress bar for owned / to buy / to read, marks gaps ("Book #4: not added yet") and has bulk *mark all*. Books found by search join their series automatically. |
| **Taxonomy** | Two-level categories (e.g. Sci-Fi → Cyberpunk) and custom **shelves**, which are quick-filter tags such as *Top Priority* or *Signed Editions*. You can add, rename, drag to reorder and delete them inline from any picker, without leaving the current screen. |
| **Inline actions** | Long-press, right-click or tap **…** on a card to change its status, category or shelves, edit it, select several books or delete it (with Undo). |
| **Batch mode** | Select many books and change their status, move them to a category or sub-category, add or remove shelves, or delete them. |
| **Offline-first** | Add, edit and delete all work offline. Search results you've already loaded are cached. Books saved offline queue a background lookup that fills in the cover and details once you're back online. |
| **iOS ergonomics** | Bottom tab bar, 44pt touch targets, swipe between tabs, pull-to-refresh, notch and home-indicator safe areas, sheets that sit above the keyboard, launch screens and a Home Screen icon. |
| **Privacy** | No accounts, no analytics, no cloud. Only your search text goes to Open Library or Google Books, and you can switch even that off. The Search tab searches your own shelves and goes online only when you ask. Backups are JSON files you export yourself. |

## Quick start

```bash
cd dream-bookshelf
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest + fake-indexeddb)
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build (service worker active)
```

Node 20.19+ (or 22.12+) is required.

### Use it on your iPhone

Service workers need HTTPS, so deploy `dist/` to any static host. Then in Safari tap
**Share → Add to Home Screen**. Installed PWAs open full-screen, work offline, and are exempt
from Safari's 7-day storage clean-up for websites.

| Host | Notes |
|---|---|
| Netlify / Vercel / Cloudflare Pages | Build command `npm run build`, output `dist`. |
| GitHub Pages (project site) | Already set up: [`.github/workflows/pages.yml`](.github/workflows/pages.yml) tests, builds and publishes on every push to `main`. One-time step: **Settings → Pages → Source: GitHub Actions**. The app is then at `https://<user>.github.io/<repo-name>/`, on its own site, deployed independently of any other app. To build by hand for a sub-path, run `BASE_PATH=/<repo-name>/ npm run build`. |

## Tech stack

- **React 19 + TypeScript + Vite 8** with a static build and no server.
- **Tailwind CSS v4**: design tokens live in `@theme` in [`src/styles/index.css`](src/styles/index.css).
- **Dexie 4** (IndexedDB) with `dexie-react-hooks` live queries.
- **vite-plugin-pwa** (`injectManifest`) with a hand-written Workbox service worker in [`src/sw.ts`](src/sw.ts) and a hand-written [`public/manifest.json`](public/manifest.json).
- **Open Library API** as the primary metadata source, with **Google Books API** as the fallback.
- `zustand` for UI state, `@dnd-kit` for drag-and-drop, `lucide-react` icons, and a self-hosted **Newsreader** variable serif font.

## Project structure

```
dream-bookshelf/
├── index.html                  # iOS meta tags, viewport-fit=cover, launch-screen links
├── public/
│   ├── manifest.json           # Web App Manifest (standalone, #12100E)
│   ├── logo.svg                # source for every icon (npm run icons)
│   ├── pwa-*.png, apple-touch-icon-180x180.png, maskable-icon-512x512.png
│   └── splash/                 # iOS launch screens (not precached)
├── pwa-assets.config.ts        # icon / splash generator config
├── vite.config.ts              # Vite + Tailwind + PWA (injectManifest)
└── src/
    ├── sw.ts                   # service worker: precache, SPA fallback, cover & API caching
    ├── main.tsx, App.tsx       # bootstrap, DB gate, app shell, error boundary
    ├── styles/index.css        # Tailwind v4 theme tokens + base styles
    ├── db/
    │   ├── types.ts            # Book, Series, Category, Shelf, Cover, SyncTask
    │   ├── db.ts               # Dexie schema, indexes, default taxonomy seed
    │   ├── repo.ts             # all writes (CRUD, batch, covers, taxonomy, undo snapshots)
    │   └── backup.ts           # JSON export/import (merge/replace) + localStorage safety copy
    ├── api/
    │   ├── openLibrary.ts      # search, work details, cover URLs
    │   ├── googleBooks.ts      # fallback search, price & series info
    │   ├── metadata.ts         # merge/dedupe providers, enrichment, confident matching
    │   ├── series.ts           # "Title (Series, #2)" style parsing
    │   └── http.ts             # fetch with timeouts, offline + rate-limit errors
    ├── sync/
    │   ├── enqueue.ts          # add tasks to the persistent queue
    │   └── queue.ts            # retry/backoff engine run on launch/online/visible/pull
    ├── store/                  # zustand: UI (tabs, sheet stack, selection, toasts), settings
    ├── hooks/                  # live library, covers, gestures, visual viewport, online
    ├── lib/                    # pure helpers (filter/sort/search, ISBN, image compression…)
    ├── components/             # ui/, layout/, books/, add/, series/, categories/, batch/, settings/
    └── views/                  # Shelves, Series, Search, Categories, Settings
```

## Architecture notes

### IndexedDB schema (`src/db/db.ts`)

| Table | Key / indexes | Notes |
|---|---|---|
| `books` | `id`, `title`, `status`, `categoryId`, `subCategoryId`, `seriesId`, `*shelfIds`, `*authors`, `isbn`, `metadataState`, `createdAt`, `updatedAt` | `*` = multi-entry index (e.g. "books on shelf X" is an index lookup). |
| `series` | `id`, `title`, `status`, `categoryId`, `*shelfIds`, … | Volumes are ordinary books with `seriesId` + `seriesIndex`. |
| `categories` | `id`, `parentId`, `order` | `parentId: null` marks a main category; anything else is a sub-category. |
| `shelves` | `id`, `order` | Custom quick-filter tags. |
| `covers` | `id` | Image blobs live apart from books, so listing books never loads images. |
| `syncQueue` | `++id`, `type`, `entityId`, `nextAttemptAt` | Background tasks: `enrich-book`, `cache-cover`. |

The first launch seeds a starter taxonomy (Sci-Fi → Cyberpunk / Space Opera, Fantasy, Dark
Academia, …) and three shelves. All of them can be edited.

### Offline-first engine

1. **App shell**: the service worker precaches HTML, JS, CSS, fonts and icons, so the app
   launches with no network. Navigations fall back to `index.html`.
2. **Data**: everything is read from and written to IndexedDB. One live query per table feeds
   the whole UI, so every view updates the moment a write lands.
3. **Covers**: when a book with an online cover is saved, a `cache-cover` task downloads,
   resizes (≤480px JPEG) and stores it in IndexedDB. The service worker also caches cover
   images (cache-first) as a second layer. Uploaded photos are compressed before they are stored.
4. **Background sync on iOS**: iOS has no Background Sync API, so the queue runs from the page
   on launch, on `online`, when the app returns to the foreground, every 2 minutes while
   visible, and on pull-to-refresh. It uses exponential backoff (30s → 6h) and gives up after
   6 attempts, which you can retry from Settings.
5. **Safety net**: the library (without image blobs) is mirrored to `localStorage` after every
   change. If IndexedDB ever comes back empty while that copy has data, the app offers a
   one-tap restore. It also asks for `navigator.storage.persist()`.

### Metadata

`searchBooks()` queries Open Library first. If Open Library errors or returns fewer than 4
results (for an ISBN: no result, cover or description), it tops up from Google Books. Results
are de-duplicated by ISBN or title + author and merged field by field. Tapping a result
fetches the description in the background without blocking **Save**. Background enrichment
only accepts **confident** matches: the same ISBN, or a similar title plus a matching author
surname. It **never overwrites** fields you typed.

Google's anonymous quota is shared and runs out easily. Adding a free API key in Settings makes
the fallback reliable. The key is stored on the device and left out of backups.

### iOS details

- `viewport-fit=cover` + `env(safe-area-inset-*)` padding, `black-translucent` status bar.
- 16px form text so Safari doesn't zoom into inputs; `-webkit-tap-highlight-color: transparent`;
  `-webkit-touch-callout: none` on cards so long-press opens quick actions, not the image menu.
- **Keyboard priming** (`src/lib/keyboard.ts`): the **+** tap focuses a hidden input inside
  the gesture, then hands focus to the search field once its sheet mounts, so the keyboard is
  already open.
- **Visual viewport** CSS variables keep bottom sheets and toasts above the keyboard.
- Launch screens for current iPhones and iPads; regenerate with `npm run icons`.
- Respects `prefers-reduced-motion`.

### Backup format

`Settings → Backup & restore → Export` makes `bibliotheca-YYYY-MM-DD.json`. On iOS it opens
the share sheet (Save to Files, AirDrop…):

```jsonc
{
  "format": "dream-bookshelf-backup",
  "version": 1,
  "exportedAt": "2026-10-01T12:00:00.000Z",
  "books": [/* Book */], "series": [/* Series */],
  "categories": [/* Category */], "shelves": [/* Shelf */],
  "covers": [{ "id": "…", "type": "image/jpeg", "data": "<base64>" }], // optional
  "settings": { /* preferences, never the API key */ }
}
```

Import offers **Merge** (newer `updatedAt` wins, nothing local is lost) or **Replace**.

## Tests

`npm test` runs unit tests for ISBN handling, series-title parsing, provider response mapping
(fixtures), search fallback and merging, the repository (CRUD, batch, taxonomy cascades,
undo), backup round-trips, the sync queue's retry/backoff, and library filter/sort/search.
