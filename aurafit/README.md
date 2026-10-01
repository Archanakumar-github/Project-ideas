# AuraFit

A private, offline-first **personal fitness & diet coach** that runs as a Progressive Web App.
You bring one Markdown file, `user_profile.md`. AuraFit reads it and generates your calorie
and macro targets, a 7-day meal plan, a weekly training program and a daily schedule. It
then tracks meals, water, workouts, weight, body measurements and a journal, and an
on-device coach answers questions from all of it.

Built for iPhone (Safari and Chrome) and installable to the Home Screen. Everything is stored
on your device, encrypted.

**[Open the app](https://archanakumar-github.github.io/aurafit/)**

## Features

| | |
|---|---|
| **Profile import** | Drag and drop `user_profile.md`, pick it from Files, paste it, or try the bundled sample. The parser understands `Key: value` bullets, tables, YAML front matter and plain prose ("I'm 5'11" and weigh 212 lbs"). Values it had to guess are flagged for review before the plan is built. |
| **Generated plan** | Targets come from BMR (Katch-McArdle with body fat %, otherwise Mifflin-St Jeor), lifestyle activity plus training sessions, and your goal and pace. Every number shows how it was calculated, and values you set in the file always win. |
| **Diet** | A daily checklist for Breakfast, Lunch, Dinner and Snacks. Tick a meal (1 tap), swap it (1 tap, with Undo) or open it for ingredients, method and online recipe ideas. Off-plan foods: one tap re-adds a recent food; search 100+ built-in foods, or millions via Open Food Facts when online; "quick calories" takes typed macros. Macros and calories update live. Also a week view and a grocery list. |
| **Water** | +250 / +500 / +750 ml buttons, a progress bar, Undo, and a bigger target on training days. |
| **Workouts** | The program follows your schedule and split, equipment, experience and injuries (movements that load an injured knee, back or shoulder are left out). During a session: sets × reps × weight inputs, a ✓ per set, an auto rest timer (−15/+15/skip, chime), substitute and info buttons, and "last time" values. Weights suggest themselves using double progression. A "lighter session" option drops a set and uses about 80% loads. |
| **Metrics** | Weight with goal progress, 3-week trend, ETA and a 7-day average line. Neck, chest, arms, waist, hips, thighs, calves and body fat %, each with its own trend chart. A weekly view covers calories, protein and water against targets. Charts are lightweight SVG with tap-to-read values and a table view. |
| **Journal** | Markdown entries (toolbar and preview) with energy, soreness, mood and sleep ratings. Entries auto-save with timestamps. The coach turns these check-ins into a daily **readiness score** that can scale training down. |
| **Coach** | A chat that works offline and on-device. It knows your profile, today's meals and training, progress and journal. It suggests meal swaps, adjusts workouts, finds exercise alternatives, explains targets and logs things ("I drank 500 ml"), with one-tap action buttons. Red-flag symptoms get a "stop and get checked" reply. **Optional:** add your own Anthropic API key to get Claude's free-form answers (off by default). |
| **Privacy** | No account, no analytics, no server. AES-GCM-256 encryption at rest, an optional passcode lock, 1-tap JSON backup and Markdown report export, and JSON import. |

## Quick start

```bash
cd aurafit
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (Vitest + fake-indexeddb)
npm run build      # type-check + production build to dist/
npm run preview    # serve the production build (service worker active)
```

Node 20.19+ (or 22.12+) is required. To use AuraFit on an iPhone, deploy `dist/` to any HTTPS static host, open it in
Safari, then tap **Share → Add to Home Screen**. Encryption needs a secure context (HTTPS or `localhost`). On a
plain-`http` LAN address the app still runs, stores data unencrypted, says so in Settings, and encrypts it
automatically the first time it's opened over HTTPS.

| Host | Notes |
|---|---|
| Netlify / Vercel / Cloudflare Pages | Build `npm run build`, output `dist`. |
| GitHub Pages (project site) | Already set up: [`.github/workflows/pages.yml`](.github/workflows/pages.yml) tests, builds and publishes on every push to `main`. One-time step: **Settings → Pages → Source: GitHub Actions**. The app is then at `https://<user>.github.io/<repo-name>/`, on its own site, deployed independently of any other app. To build by hand for a sub-path, run `BASE_PATH=/<repo-name>/ npm run build`. |

## Writing `user_profile.md`

Start from [`user_profile.example.md`](user_profile.example.md), or download it from the setup screen. Headings, order and
wording are flexible. These are the things the importer looks for:

| Area | Examples it understands |
|---|---|
| Body | `Age: 34` or `DOB: 1991-04-02` · `Sex: F` · `Height: 168 cm` / `5'9"` / `1.75 m` · `Weight: 74 kg` / `163 lbs` / `11 st 4 lb` · `Body fat: 30%` |
| Goals | `Primary goal: lose fat` · `Target weight: 66 kg` · `Target date: 2027-03-31` or `in 12 weeks` · `Rate: 0.5 kg per week`, plus any goal bullets |
| Activity | `Activity level: lightly active, desk job` · `Occupation: nurse` |
| Nutrition | `Diet: vegetarian (no eggs)` / vegan / pescatarian / keto / low-carb / Mediterranean / paleo / halal / kosher / Jain · `Allergies: peanuts` · `Intolerances: lactose` · `Dislikes: mushrooms, olives` · `Meals per day: 3 meals + 1 snack` · `Eating window: 12:00–20:00 (16:8)` |
| Targets | `Daily calories: 1800` (or `auto`) · `Protein: 130 g` / `1.8 g/kg` / `30%` · `Macros: 40/30/30 (C/P/F)` · `Water: 2.5 L` / `8 glasses` / `100 oz` |
| Training | `Training days: Mon, Tue, Thu, Sat` / `Mon–Fri` / `4x per week` · a `Day | Focus` table or `Monday: Upper body` lines (`Long run 45 min`, `Yoga`, `Rest` work too) · `Session length: 50 min` · `Experience: intermediate` / `3 years` · `Equipment: dumbbells, bands, pull-up bar` or `full gym` · `Preferred time: 07:00` / `after work` · `Injuries: old knee injury` |
| Lifestyle | `Wake up: 06:15` · `Bedtime: 22:30` · `Work hours: 9–5:30` · `Steps goal: 9k` · routine bullets |
| Measurements | A table or bullets for neck, chest, arms, waist, hips, thighs, calves (cm or inches) |

Re-import the file at any time (Settings → Re-import). Targets, meals and the program are rebuilt, and all logs are kept.

## How plans are generated

All generation is deterministic code in [`src/engine/`](src/engine). Nothing is a black box, and each step is unit-tested.

- **Targets** ([`targets.ts`](src/engine/targets.ts)): TDEE = BMR × (daily-life factor + 0.035 per weekly session). The goal adjustment comes from the requested weekly rate (7,700 kcal per kg), capped at 1% of body weight per week and never below a safe floor. Protein is by goal in g/kg (based on a reference weight when BMI > 30). Fat is a share of calories (keto and low-carb adjust it), and carbs fill the rest. Water is 35 ml/kg plus a training-day bonus.
- **Meals** ([`mealPlanner.ts`](src/engine/mealPlanner.ts)): meal slots and times come from meals/snacks per day, the fasting window, wake/sleep times and a morning workout. 68 meal templates are filtered by diet rules derived from the ingredients (no hand-maintained "vegan" tags). They're ranked by protein density and favourite cuisines, rotated across the week with a seeded shuffle, and scaled to each slot's calorie share. Snacks are upgraded when a day's protein runs short.
- **Training** ([`programBuilder.ts`](src/engine/programBuilder.ts)): explicit schedule lines win. Otherwise the split is chosen from days per week (full body → upper/lower → hybrid → PPL). Each focus maps to movement patterns, and each pattern gets the best of 100+ exercises that fits the equipment, avoids injured areas and matches the experience level, with A/B variations. Sets, reps and rest follow the goal, and session length sets the exercise count.
- **Schedule** ([`schedule.ts`](src/engine/schedule.ts)): wake → routines → meals → work → workout → walks → water check-ins → wind-down → sleep.
- **Coach** ([`localCoach.ts`](src/coach/localCoach.ts)): intent routing over a context snapshot ([`context.ts`](src/coach/context.ts)). Readiness is scored from the latest journal check-in ([`insights.ts`](src/engine/insights.ts)).

## Privacy & security

- **At rest:** every document (profile, plan, each day's log, each journal entry, settings, chat) is sealed with
  AES-GCM-256 and a fresh IV before it reaches IndexedDB ([`src/db/vault.ts`](src/db/vault.ts)). By default the key is a
  **non-extractable** WebCrypto key: the app can use it, but its bytes can't be read or exported. With a
  **passcode** (Settings → Privacy & security), the key is derived with PBKDF2-SHA-256 (600,000 rounds), lives
  only in memory while unlocked, and the app opens to a lock screen. There's no recovery if you forget the
  passcode, so export a backup first.
- **Auto-save:** state updates in memory on every tap, and changed documents are written behind within ~50 ms. Writes
  flush again when the app is backgrounded (`pagehide` / `visibilitychange`). AuraFit also asks the browser for persistent storage.
- **Network:** only when online, and only with "Online enhancements" on. Food search terms go to Open Food Facts, a
  main ingredient to TheMealDB, and an exercise name to wger. The service worker doesn't cache these JSON responses,
  and foods you pick are saved, encrypted, in the app's own database.
- **Optional cloud coach:** off by default. When enabled with your own Anthropic API key, each question and a compact
  summary of your profile, today's logs and recent journal notes go directly from the device to the Claude API.
  It uses the official SDK, streaming, model `claude-opus-5-5` by default, and server-side refusal fallback. The key is stored
  encrypted and is never included in backups. Safety questions and logging commands are always handled on-device.
- **Your data:** Settings offers a JSON backup (lossless, re-importable, unencrypted, so keep it safe), a Markdown
  report, JSON import, and erase-everything.

## Tech stack

- **React 19 + TypeScript + Vite 8**, a static build with no server. `<Activity>` keeps visited tabs mounted.
- **Tailwind CSS v4** design tokens with light and dark themes ([`src/styles/index.css`](src/styles/index.css)). Data colours follow a
  validated categorical order (protein, carbs, fat).
- **IndexedDB + WebCrypto** through a small custom wrapper (no ORM). **zustand** handles in-memory state.
- **vite-plugin-pwa** (`injectManifest`) with a hand-written Workbox service worker ([`src/sw.ts`](src/sw.ts)) that precaches the whole app.
- **Open Food Facts**, **TheMealDB** and **wger** public APIs. The optional **Claude API** uses `@anthropic-ai/sdk`, which is lazy-loaded.
- `lucide-react` icons, a safe in-house Markdown renderer (no `innerHTML`) and hand-rolled SVG charts.

## Project structure

```
aurafit/
├── user_profile.example.md     # the sample / template profile
├── index.html                  # iOS meta, theme-before-paint script, launch screens
├── public/                     # manifest.json, logo.svg, icons, splash/
└── src/
    ├── types.ts                # Profile, Plan, DayLog, WorkoutSession, JournalEntry, ...
    ├── data/                   # foods.ts, recipes.ts, exercises.ts (offline libraries)
    ├── engine/                 # profileParser, values, targets, dietRules, mealPlanner,
    │                           # programBuilder, schedule, plan, insights, nutrition
    ├── db/                     # idb.ts, crypto.ts, vault.ts (encrypted store), backup.ts
    ├── store/                  # app.ts (state + write-behind persistence), ui.ts
    ├── coach/                  # context, localCoach (offline), cloudCoach (optional), actions
    ├── api/                    # openFoodFacts, mealDb, wger, http
    ├── components/             # ui primitives, charts, sheets per feature, layout
    ├── views/                  # Setup, Lock, Today, Diet, Train, Progress, Journal
    └── sw.ts                   # service worker
```

## Performance

The whole app (every lazy chunk) is precached, so it launches instantly offline. The main bundle is about 140 KB gzipped. The
Claude SDK (50 KB gzipped) loads only if the cloud coach is used. Measured interaction-to-next-paint in headless Chromium at
iPhone size: **24–32 ms worst case** for logging water, ticking meals and sets, switching tabs and opening the coach.
Under 4× CPU throttling (a pessimistic stand-in for older phones) most actions take 60–140 ms, and starting a workout
(mounting ~30 inputs) up to ~190 ms.

## Disclaimer

AuraFit gives general fitness and nutrition guidance from what you tell it. It is not medical advice. If you're
pregnant, have a medical condition, an eating disorder, or pain or dizziness when training, check your plan with a
qualified professional.
