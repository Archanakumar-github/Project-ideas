# Project-ideas

Each app lives in its own repository and is published to its own GitHub Pages site, so each one
is tested, built and deployed on its own, and none of them can break or replace another.

| App | Repository | Open the app |
|---|---|---|
| **Bibliotheca**: a private, offline-first PWA (React + Dexie + Tailwind) for tracking the books and series you want to read and buy. Optimised for iPhone. | [bibliotheca](https://github.com/Archanakumar-github/bibliotheca) | [archanakumar-github.github.io/bibliotheca](https://archanakumar-github.github.io/bibliotheca/) |
| **cinémathèque.**: a private, text-only film & series log for iPhone. Multi-list titles, nested sub-lists, MCU-style timelines with films and series cross-linked, optional online lookup, an optional encrypted passcode lock, offline PWA. | [cinematheque](https://github.com/Archanakumar-github/cinematheque) | [archanakumar-github.github.io/cinematheque](https://archanakumar-github.github.io/cinematheque/) |
| **AuraFit**: a private, offline-first fitness & diet coach PWA (React + IndexedDB + WebCrypto + Tailwind). Import a `user_profile.md` and it generates your targets, meal plan, training program and schedule, then tracks meals, water, workouts, body metrics and a Markdown journal, with an on-device AI coach. Optimised for iPhone. | [aurafit](https://github.com/Archanakumar-github/aurafit) | [archanakumar-github.github.io/aurafit](https://archanakumar-github.github.io/aurafit/) |
| **Ethereal**: a private, offline-first dream vision board: a native iPhone/Android app (React Native + Expo, SQLite, Reanimated) for curating the home, places, life, objects and books you dream of. The same code runs as an installable web app. | [ethereal](https://github.com/Archanakumar-github/ethereal) | [archanakumar-github.github.io/ethereal](https://archanakumar-github.github.io/ethereal/) |

## How they stay independent

- **One repository, one site, one app.** A repository has a single GitHub Pages site and every
  deployment replaces all of it. With an app per repository, a push to one app publishes only that
  app, and a failing build of one app never holds back or takes down another.
- **No app sits inside another.** The apps are siblings (`/bibliotheca/`, `/cinematheque/`,
  `/aurafit/`, `/ethereal/`), so each service worker controls only its own app.
- **Separate storage.** All four share the `archanakumar-github.github.io` origin, so each keeps its
  data, settings and caches under its own names (`dream-bookshelf`, `cinematheque:*`, `aurafit`,
  `ethereal`).

Each repository's `.github/workflows/pages.yml` tests and builds every pull request and publishes
on every push to `main`. One-time step per repository: **Settings → Pages → Source: GitHub Actions**.

## Moving from the old addresses

Bibliotheca and cinémathèque. used to be published from this repository, at `/Project-ideas/` and
`/Project-ideas/cinematheque/`. Those copies stay online, unchanged, until this repository's Pages
site is unpublished, so nothing installed from them stops working. To move to the new addresses:

1. In the old app, export a backup (Bibliotheca: **Settings → Export backup**; cinémathèque.:
   **⋯ → Backup → Export**) and save it to Files.
2. Open the new address in Safari, **Share → Add to Home Screen**, then import the backup.
3. Once everything is moved, delete the old Home Screen icons, and unpublish this repository's
   site (**Settings → Pages**).

The apps' history up to the move is also kept in this repository's history.
