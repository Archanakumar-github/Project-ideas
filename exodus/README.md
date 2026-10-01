# exodus.

A private, text-only film and series log, built for iPhone. No posters, no accounts, no server. Your library lives on your device.

*Cinematic Midnight Minimal*: obsidian `#0D0E12`, off-white titles in Inter, archival metadata in JetBrains Mono, and Analog Theatre Red `#E53E3E` only for active states.

## Install it on your iPhone

exodus. is a web app you install once. After that it runs from your Home Screen like any other app, fully offline, and every title, list and change you make is saved on the phone the moment you make it.

1. **Put it online once.** Merge the pull request into `master`. The repo's GitHub Pages workflow publishes exodus. next to Bibliotheca. A minute later it's live at **`https://archanakumar-github.github.io/Project-ideas/exodus/index.html`**.
   (Pages must be set to **Settings → Pages → Source: GitHub Actions**; it already is for Bibliotheca.) Only the app's code is hosted. Your library never leaves the phone.
2. **Open that link in Safari** on the iPhone and tap **Share → Add to Home Screen**. The app shows a reminder until you do.
3. **Open exodus. from the Home Screen.** It's now an installed app:
   - **Offline.** The whole app is stored on the phone; no connection is needed after the first visit.
   - **Saves everything automatically**, with no save button. Data survives closing the app, restarting the phone and app updates. Home Screen apps are also exempt from Safari's habit of clearing website data after weeks without a visit.
   - **Updates itself** the next time you open it with a connection; your library is untouched.
   - **Private.** No account, no server, no tracking. Add a passcode in **⋯ → Privacy** to encrypt it.

The one thing that removes your library is deleting the app from the Home Screen (or erasing the phone). So use **⋯ → Backup → Export** now and then, and save the file to iCloud Drive or Files. It restores everything with **Import**, on this or another phone. The app reminds you once a month.

To run it on a computer, use `npm start` (any static server works). Offline mode and the passcode lock need `https://` or `localhost`.

## How it works

| You want to… | Do this |
|---|---|
| Add a title | Tap **+**. Type `Dune (2021)` and the year fills itself in. Pick lists as chips and tap **ADD**. **ADD + NEXT** (or Return) keeps the sheet open for the next one. |
| Look a title up online | Start typing in the add sheet. Matches **from the web** (Wikidata) appear under the title; tap one and the year, film/series and genres fill themselves in. Existing titles: tap the row → **↗ FIND ONLINE**. **⋯ → Fill in missing years online** does the whole library (only unambiguous matches are applied, with one UNDO). Offline, this simply steps aside and you type as normal. |
| Add many at once | **+ → BULK**: paste one title per line. `Loki (2021) [tv]`, `film: Eternals`, numbered lists and spreadsheet columns all work, and the order is kept. |
| Add straight into a list | Tap the **+** on that list's header. |
| File a title in more lists | Start typing an existing title in the add sheet and tap the suggestion. Or tap the row and tick lists. |
| Edit | Tap a row, or swipe it left → **EDIT**. |
| Remove or delete | Swipe left → **REMOVE** (from this list only) or **DELETE** (when it's the title's only list). The row's sheet has **Delete log completely**. Every destructive action has **UNDO**. |
| Mark watched | Tap the ring at the start of the row. Use **ALL · WATCHED · TO WATCH** to filter. |
| Favorite | Tap a row → **☆ FAVORITE**. Favorites is its own list at the top. |
| Make a list or sub-list | **⋯** (top right) → Lists, or type `Parent / Sub` anywhere you can create a list (`MCU / Phase Seven`). Lists nest three levels deep. |
| Rename, sort, reorder or delete a list | Tap the list's **⋯**. Sorts are Custom, A–Z, Year ↑, Year ↓ and Recent. **Reorder titles by dragging** gives each row a ≡ handle. |
| Track a franchise in order | Set the list's format to **TIMELINE**. Titles are numbered across all its sub-lists (phases) in the order you set. **Menu → Load the MCU timeline** builds Phases One–Six for you. |

### Edits stay in their list

The same title can sit in any number of lists, and each list keeps its own copy of the details:

- **Editing** from inside a list changes it **only in that list** by default. Choose **All N lists** to update it everywhere. **Reset to shared** drops a list's custom version.
- **Removing** takes the title out of that one list. A title in no list moves to **Unsorted**, so nothing is lost by accident.
- **Delete log completely** is the only action that removes a title from every list.
- Watch status and favorite belong to the title itself, so marking something watched shows everywhere.

### Films, series and cross-linking

Every title is either a **film** or a **series**, and appears under MOVIES or TV SERIES accordingly. A list with **Cross-link films & series** turned on shows both kinds under either tab, in one shared order. Titles of the other kind carry a small `TV` / `FILM` marker. Timelines are cross-linked by default, so *Loki* counts as a series but still sits between *Black Widow* and *What If…?* in the MCU.

## Privacy and security

- **On-device only.** No analytics or third-party code; fonts and icons are bundled. The only network requests are optional title lookups to Wikidata (free, no account): just the title you type is sent, never your library. Turn them off in **⋯ → Online lookup**. Lookups are cached on the phone, so ones you've done before also work offline.
- **Optional passcode lock** (**⋯ → Privacy**). The library is encrypted at rest with AES-256-GCM, using a key derived from your passcode with PBKDF2-SHA-256 (310,000 iterations) via WebCrypto. The passcode is never stored. After 5 wrong tries, the wait between attempts grows. The app auto-locks after it's been in the background for 1–15 minutes (you choose), and blanks its app-switcher preview. A forgotten passcode cannot be recovered, so export a backup first.
- **Strict Content-Security-Policy:** `'self'` only and no inline script. User text is only ever inserted as text, never as HTML.
- **Imported backups are sanitised**: unknown fields are dropped, lengths bounded, links between titles and lists verified, and prototype-pollution keys rejected.
- **Backups:** **⋯ → Backup** exports a `.json` file (iOS opens the share sheet → Save to Files). You can import it to merge into this library or to replace it.

## Development

No build step: plain ES modules, HTML and CSS.

```
exodus/
  index.html            shell + CSP
  css/app.css           the whole visual system
  js/model.js           data layer (pure functions, unit-tested)
  js/vault.js           localStorage + AES-GCM encryption
  js/app.js             UI: rendering, sheets, swipe, drag, lock
  js/starter.js         MCU timeline template
  js/lookup.js          optional online lookup (Wikidata), cached on device
  sw.js                 offline support (network-first app code, cached fallback)
  tests/                node:test unit tests + Playwright end-to-end test
```

```sh
npm test            # data-layer unit tests (no install needed)
npm i && npm run test:e2e   # drives the app in an iPhone-sized Chromium
```

Fonts: Inter and JetBrains Mono, both SIL Open Font License (see `fonts/`).
