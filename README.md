# Project-ideas

| Project | Description |
|---|---|
| [Bibliotheca](dream-bookshelf/) · **[Open the app](https://archanakumar-github.github.io/Project-ideas/)** | A private, offline-first PWA (React + Dexie + Tailwind) for tracking the books and series you want to read and buy. Optimised for iPhone. |
| [cinémathèque.](cinematheque/) · **[Open the app](https://archanakumar-github.github.io/Project-ideas/cinematheque/index.html)** | A private, text-only film & series log for iPhone. Multi-list titles, nested sub-lists, MCU-style timelines with films and series cross-linked, optional online lookup, an optional encrypted passcode lock, offline PWA. |
| [Ethereal](ethereal/) · **[Open the app](https://archanakumar-github.github.io/Project-ideas/ethereal/index.html)** | A private, offline-first dream vision board: a native iPhone/Android app (React Native + Expo, SQLite, Reanimated) for curating the home, places, life, objects and books you dream of. The same code runs as an installable web app. |

## Publishing: every app, side by side

All apps are published to one GitHub Pages site by a single workflow,
[`.github/workflows/pages.yml`](.github/workflows/pages.yml), on every push to `master` that
touches any of them:

| Address | App |
|---|---|
| `/Project-ideas/` | Bibliotheca |
| `/Project-ideas/cinematheque/` | cinémathèque. |
| `/Project-ideas/aurafit/` | AuraFit (published automatically once the `aurafit/` folder is on `master`) |
| `/Project-ideas/ethereal/` | Ethereal |

- **One deployment holds every app.** A repository has a single Pages site and each deployment
  replaces all of it, so the workflow builds each app in its own job and assembles them into one
  site. If any build fails, nothing is deployed and the live site keeps working exactly as before.
- **The apps can't interfere with each other.** Each app has its own service worker scoped to its
  own folder, its own caches and its own on-device database. Bibliotheca's worker, which sits at
  the top level, skips the other apps' folders and only clears its own old caches.
- **Use the `…/index.html` links above.** Copies of Bibliotheca's worker installed before this
  layout ignore addresses that end in a file name, so those links always open the right app.

To add another app, build it for the base path `/<repo>/<folder>/`, add a job and a
download step to `pages.yml`, and add the folder name to `SIBLING_APPS` in
[`dream-bookshelf/src/sw.ts`](dream-bookshelf/src/sw.ts).
