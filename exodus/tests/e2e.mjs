// End-to-end check in an iPhone-sized Chromium.
// Run: npm run test:e2e            (needs `npm i` for Playwright)
//      SHOTS=/tmp/shots npm run test:e2e   to also save screenshots
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium, devices } from 'playwright';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHOTS = process.env.SHOTS || '';
const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let file = path.join(root, decodeURIComponent(url.pathname));
  if (!file.startsWith(root)) return res.writeHead(403).end();
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://localhost:${server.address().port}/`;

const browser = await chromium.launch();
const { defaultBrowserType, ...iphone } = devices['iPhone 13'];
const context = await browser.newContext({ ...iphone, serviceWorkers: 'block' });

// Canned Wikidata responses (same shapes as the live API) so the test never depends on the internet.
const WD_SEARCH = {
  'perfect days': [
    { id: 'Q115632389', label: 'Perfect Days', description: '2023 film by Wim Wenders' },
    { id: 'Q7168539', label: 'Perfect Days', description: 'song by Bonnie Tyler' },
  ],
  persona: [
    { id: 'Q543382', label: 'Persona', description: '1966 film by Ingmar Bergman' },
    { id: 'Q3376536', label: 'Persona', description: 'video game series' },
  ],
};
const WD_DETAILS = {
  Q115632389: { date: '2023-11-10T00:00:00Z', genres: 'drama film', countries: 'Japan|Germany' },
};
const wdCalls = [];
async function wikidata(route) {
  const url = new URL(route.request().url());
  wdCalls.push(url.hostname);
  const cors = { 'access-control-allow-origin': '*', 'content-type': 'application/json' };
  if (url.hostname === 'www.wikidata.org') {
    const q = (url.searchParams.get('search') || '').toLowerCase();
    return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ search: WD_SEARCH[q] || [] }) });
  }
  const ref = (url.searchParams.get('query') || '').match(/wd:(Q\d+)/)?.[1];
  const d = WD_DETAILS[ref];
  const binding = d ? { date: { value: d.date }, genres: { value: d.genres }, countries: { value: d.countries } } : {};
  return route.fulfill({ status: 200, headers: cors, body: JSON.stringify({ results: { bindings: [binding] } }) });
}
await context.route(/^https:\/\/(www|query)\.wikidata\.org\//, wikidata);
const page = await context.newPage();
const problems = [];
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') problems.push(`console: ${m.text()}`);
});

let n = 0;
async function shot(name) {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  await page.waitForTimeout(550);
  await page.screenshot({ path: path.join(SHOTS, `${String(++n).padStart(2, '0')}-${name}.png`) });
}
const noNullText = async (where) => {
  const bad = await page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) if (/^(null|undefined)$/.test(n.textContent.trim())) return n.parentElement.outerHTML.slice(0, 120);
    return '';
  });
  assert.equal(bad, '', `stray null/undefined text (${where})`);
};
const rows = (sel = '') => page.locator(`#list ${sel} .row`);
const section = (name) => page.locator('#list section.cat', { has: page.locator(':scope > .ch .nm', { hasText: new RegExp(`^${name}$`) }) }).first();
const sheet = page.locator('#sheet');
const closeSheet = async () => {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
};
async function swipeLeft(row) {
  const box = await row.boundingBox();
  const y = box.y + box.height / 2;
  await row.evaluate((el, { y, x0 }) => {
    const fire = (type, x) => el.querySelector('.tt').dispatchEvent(new PointerEvent(type, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true }));
    fire('pointerdown', x0);
    for (let x = x0; x >= x0 - 200; x -= 20) fire('pointermove', x);
    fire('pointerup', x0 - 200);
  }, { y, x0: box.x + box.width - 30 });
  await page.waitForTimeout(450);
}

try {
  await page.goto(base);
  await page.waitForSelector('.empty');
  assert.match(await page.locator('.brand').first().textContent(), /exodus\./);
  await shot('welcome');

  // --- MCU template: phases, numbering, films + series cross-linked
  await page.getByRole('button', { name: 'LOAD MCU TIMELINE' }).click();
  await page.waitForSelector('#list section.cat');
  const mcu = section('MCU');
  await assert.doesNotReject(mcu.waitFor());
  assert.equal(await mcu.locator('section.cat.d1').count(), 6);
  const firstRow = mcu.locator('.row').first();
  assert.equal(await firstRow.locator('.num').textContent(), '01');
  assert.equal(await firstRow.locator('.tt').textContent(), 'Iron Man');
  assert.ok((await mcu.locator('.row .xt', { hasText: 'TV' }).count()) > 5, 'series visible inside MCU under MOVIES');
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot('mcu-movies');

  await page.getByRole('tab', { name: /TV SERIES/ }).click();
  assert.ok((await section('MCU').locator('.row').count()) > 40, 'cross-linked MCU also shows under TV SERIES');
  assert.equal(await page.locator('#tabs [data-tab="tv"] .n').textContent(), '15');
  await page.locator('#list section.cat.d1', { hasText: 'Phase Four' }).first().scrollIntoViewIfNeeded();
  await shot('mcu-tv-phase4');
  await page.getByRole('tab', { name: /MOVIES/ }).click();

  // --- Add a film into a brand-new list, from the + button
  await page.locator('#fab').click();
  await sheet.locator('input[aria-label="Title"]').fill('Dune (2021)');
  await sheet.locator('input[aria-label="Tags"]').first().fill('Epic, Desert');
  await sheet.getByRole('button', { name: '+ NEW LIST' }).click();
  await sheet.locator('.chip-in').fill('Sci-Fi');
  await sheet.locator('.chip-in').press('Enter');
  await sheet.getByRole('button', { name: '+ NEW LIST' }).click();
  await sheet.locator('.chip-in').fill('Rewatch');
  await sheet.locator('.chip-in').press('Enter');
  await shot('add-sheet');
  await sheet.getByRole('button', { name: 'ADD', exact: true }).click();
  await page.waitForTimeout(500);
  const sciRow = section('Sci-Fi').locator('.row').first();
  assert.equal(await sciRow.locator('.tt').textContent(), 'Dune');
  assert.equal(await sciRow.locator('.yr').textContent(), '2021');
  assert.equal(await sciRow.locator('.tags span:not(.mn)').allTextContents().then((t) => t.join(' ')), '[Epic] [Desert]');
  assert.equal(await section('Rewatch').locator('.row').count(), 1);

  // --- Bulk add keeps order and type markers
  await section('Sci-Fi').locator(':scope > .ch [data-act="add"]').click();
  await sheet.getByRole('radio', { name: 'BULK' }).click();
  await sheet.locator('textarea').fill('Arrival (2016)\nAnnihilation, 2018\nSevered [tv] (2022)');
  assert.match(await sheet.locator('.preview .p-sum').textContent(), /3 TITLES · 2 FILM · 1 SERIES/);
  await sheet.getByRole('button', { name: 'ADD 3' }).click();
  await page.waitForTimeout(500);
  assert.match(await page.locator('#toast .msg').textContent(), /^Added 3 → Sci-Fi/);
  assert.deepEqual(await section('Sci-Fi').locator('.row .tt').allTextContents(), ['Dune', 'Arrival', 'Annihilation']);

  // --- Online lookup fills in year, type and genres; the log remembers its Wikidata id
  await page.locator('#fab').click();
  await sheet.getByRole('radio', { name: 'SERIES' }).click();
  await sheet.locator('input[aria-label="Title"]').fill('Perfect Days');
  const hit = sheet.locator('.web-r', { hasText: '2023' });
  await hit.waitFor();
  assert.equal(await sheet.locator('.web-r').count(), 1, 'songs and other non-titles are filtered out');
  await shot('online-lookup');
  await hit.click();
  await page.waitForFunction(() => document.querySelector('#sheet input[aria-label="Tags"]').value === 'Drama');
  assert.equal(await sheet.locator('input[aria-label="Year"]').first().inputValue(), '2023');
  assert.equal(await sheet.getByRole('radio', { name: 'FILM' }).getAttribute('aria-checked'), 'true', 'type switched to film');
  assert.equal(await sheet.locator('.chip.tag', { hasText: 'Japan' }).count(), 1, 'country offered as a tag');
  await sheet.getByRole('button', { name: 'ADD', exact: true }).click();
  await page.waitForTimeout(400);
  await rows().filter({ hasText: 'Perfect Days' }).first().click();
  assert.equal(await sheet.locator('.reflink').getAttribute('href'), 'https://www.wikidata.org/wiki/Q115632389');
  await closeSheet();

  // --- Fill in missing years online: only unambiguous matches are applied
  await page.locator('#fab').click();
  await sheet.locator('input[aria-label="Title"]').fill('Persona');
  await sheet.getByRole('button', { name: 'ADD', exact: true }).click();
  await page.waitForTimeout(400);
  await page.locator('#menuBtn').click();
  await sheet.getByRole('button', { name: /Fill in missing years online/ }).click();
  await page.waitForFunction(() => document.querySelector('#toast .msg')?.textContent.startsWith('Filled in'));
  assert.equal(await rows().filter({ hasText: 'Persona' }).first().locator('.yr').textContent(), '1966');

  // --- Edit only inside one list; the other list keeps its version
  await sciRow.click();
  await page.waitForTimeout(500);
  await shot('item-sheet');
  assert.equal(await sheet.getByRole('radio', { name: /Only “Sci-Fi”/ }).getAttribute('aria-checked'), 'true');
  await sheet.locator('input[aria-label="Title"]').fill('Dune: Part One');
  await noNullText('item sheet');
  await sheet.getByRole('button', { name: 'SAVE CHANGES' }).click();
  await closeSheet();
  assert.equal(await section('Sci-Fi').locator('.row .tt').first().textContent(), 'Dune: Part One');
  assert.equal(await section('Rewatch').locator('.row .tt').first().textContent(), 'Dune');

  // --- Favorite from the sheet, then status from the row
  await section('Rewatch').locator('.row').first().click();
  await sheet.getByRole('button', { name: /FAVORITE/ }).click();
  await closeSheet();
  assert.equal(await section('Favorites').locator('.row').count(), 1);
  await section('Rewatch').locator('.row .st').first().click();
  assert.match(await section('Rewatch').locator('.row').first().getAttribute('class'), /\bw\b/);

  // --- Swipe left → REMOVE from one list only, then UNDO
  await swipeLeft(section('Rewatch').locator('.row').first());
  await shot('swipe-actions');
  await section('Rewatch').locator('.ra-del').click();
  await page.waitForTimeout(400);
  assert.equal(await section('Sci-Fi').locator('.row .tt', { hasText: 'Dune' }).count(), 1, 'still in Sci-Fi');
  assert.equal(await section('Rewatch').count(), 1, 'empty list still shown');
  assert.equal(await section('Rewatch').locator('.row').count(), 0);
  await page.locator('#toast button', { hasText: 'UNDO' }).click();
  assert.equal(await section('Rewatch').locator('.row').count(), 1);

  // --- Sub-lists from the list sheet
  await section('Sci-Fi').locator(':scope > .ch [data-act="cat"]').click();
  await sheet.locator('input[aria-label="Add a sub-list"]').fill('Space');
  await sheet.locator('input[aria-label="Add a sub-list"]').press('Enter');
  await shot('list-sheet');
  await noNullText('list sheet + toast');
  await closeSheet();
  assert.equal(await section('Sci-Fi').locator('section.cat.d1 .nm', { hasText: 'Space' }).count(), 1);

  // --- Search by title and by tag
  await page.locator('#q').fill('iron');
  await page.waitForTimeout(100);
  assert.deepEqual(await rows().locator('.tt').allTextContents(), ['Iron Man', 'Iron Man 2', 'Iron Man 3']);
  await shot('search');
  await page.locator('#q').fill('epic');
  await page.waitForTimeout(100);
  assert.equal(await rows().count(), 3, 'tag match in Sci-Fi, Rewatch and Favorites');
  await page.locator('#qx').click();

  // --- Status filter
  await page.locator('#filters [data-st="watched"]').click();
  assert.equal(await rows().count(), 3, 'status belongs to the title: Dune shows as watched in Sci-Fi, Rewatch and Favorites');
  await page.locator('#filters [data-st="all"]').click();

  // --- Reorder mode by dragging
  await section('Sci-Fi').locator(':scope > .ch [data-act="cat"]').click();
  await sheet.getByRole('button', { name: 'Reorder titles by dragging' }).click();
  await page.waitForTimeout(700);
  const handles = section('Sci-Fi').locator(':scope > .rows .drag');
  assert.equal(await handles.count(), 3);
  const h3 = await handles.nth(2).boundingBox();
  const h1 = await handles.nth(0).boundingBox();
  await page.mouse.move(h3.x + h3.width / 2, h3.y + h3.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(h3.x + h3.width / 2, h3.y + h3.height / 2 - ((h3.y - h1.y + 6) * i) / 8);
  await shot('reorder');
  await page.mouse.up();
  await page.waitForTimeout(300);
  await section('Sci-Fi').locator('.done').click();
  assert.deepEqual(await section('Sci-Fi').locator(':scope > .rows .row .tt').allTextContents(), ['Annihilation', 'Dune: Part One', 'Arrival']);

  // --- Delete a log completely (two taps)
  await section('Sci-Fi').locator('.row', { hasText: 'Arrival' }).click();
  const del = sheet.getByRole('button', { name: /Delete log completely/ });
  await del.click();
  await sheet.getByRole('button', { name: /Tap again/ }).click();
  await page.waitForTimeout(500);
  assert.equal(await rows().filter({ hasText: 'Arrival' }).count(), 0);

  // --- Menu + passcode: data is encrypted at rest and survives a reload
  await page.locator('#menuBtn').click();
  await shot('menu');
  await noNullText('menu');
  await sheet.getByRole('button', { name: /Set a passcode/ }).click();
  await sheet.locator('input[placeholder="New passcode"]').fill('2468');
  await sheet.locator('input[placeholder="Repeat passcode"]').fill('2468');
  await sheet.getByRole('button', { name: 'ENCRYPT & LOCK' }).click();
  await page.waitForFunction(() => localStorage.getItem('exodus:vault:v1') && !localStorage.getItem('exodus:v1'));
  const stored = await page.evaluate(() => localStorage.getItem('exodus:vault:v1'));
  assert.ok(!stored.includes('Dune'), 'no plaintext titles at rest');
  await page.reload();
  await page.waitForSelector('#lock:not([hidden])');
  await shot('locked');
  await page.locator('#lockPass').fill('1111');
  await page.locator('#lockGo').click();
  await page.waitForFunction(() => document.querySelector('#lockErr').textContent.includes('Incorrect'));
  await page.locator('#lockPass').fill('2468');
  await page.locator('#lockGo').click();
  await page.waitForSelector('#lock[hidden]', { state: 'attached' });
  assert.equal(await section('Sci-Fi').locator('.row .tt', { hasText: 'Dune: Part One' }).count(), 1);
  assert.equal(await section('Rewatch').locator('.row .tt', { hasText: /^Dune$/ }).count(), 1);

  // --- Backup round-trip (replace) through the file picker
  const backup = await page.evaluate(() => JSON.stringify({ app: 'exodus', v: 1, data: { items: { a1: { title: 'Stalker', year: '1979', type: 'movie' } }, cats: {}, places: {} } }));
  await page.locator('#menuBtn').click();
  const chooser = page.waitForEvent('filechooser');
  await sheet.getByRole('button', { name: /Import — replace/ }).click();
  await (await chooser).setFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(backup) });
  await page.waitForTimeout(400);
  await closeSheet();
  assert.deepEqual(await rows().locator('.tt').allTextContents(), ['Stalker']);
  await page.locator('#toast button', { hasText: 'UNDO' }).click();
  assert.ok((await rows().count()) > 20, 'undo restores the replaced library');

  // --- Offline: once loaded, the app and everything entered survive with no network at all
  const off = await browser.newContext({ ...iphone });
  const p2 = await off.newPage();
  const offErrors = [];
  p2.on('pageerror', (e) => offErrors.push(e.message));
  await p2.goto(base);
  await p2.evaluate(() => navigator.serviceWorker.ready);
  await p2.reload();
  await p2.waitForFunction(() => !!navigator.serviceWorker.controller);
  assert.equal(await p2.locator('.install').count(), 1, 'Safari install hint shown');
  await p2.locator('#fab').click();
  await p2.locator('#sheet input[aria-label="Title"]').fill('Paris, Texas (1984)');
  await p2.locator('#sheet').getByRole('button', { name: 'ADD', exact: true }).click();
  await p2.waitForTimeout(400);
  await off.setOffline(true);
  server.closeAllConnections();
  await p2.locator('#fab').click();
  await p2.locator('#sheet input[aria-label="Title"]').fill('Some title');
  await p2.waitForSelector('#sheet .web-st:has-text("OFFLINE")');
  await p2.keyboard.press('Escape');
  await p2.waitForTimeout(400);
  await p2.reload();
  await p2.waitForSelector('#list .row');
  assert.deepEqual(await p2.locator('#list .row .tt').allTextContents(), ['Paris, Texas']);
  await p2.locator('#fab').click();
  await p2.locator('#sheet input[aria-label="Title"]').fill('Wings of Desire (1987)');
  await p2.locator('#sheet').getByRole('button', { name: 'ADD', exact: true }).click();
  await p2.waitForTimeout(400);
  await p2.reload();
  await p2.waitForSelector('#list .row');
  assert.deepEqual((await p2.locator('#list .row .tt').allTextContents()).sort(), ['Paris, Texas', 'Wings of Desire'], 'changes made offline are kept');
  if (SHOTS) await p2.screenshot({ path: path.join(SHOTS, 'offline.png') });
  assert.deepEqual(offErrors, [], 'no page errors offline');
  await off.close();

  assert.ok(wdCalls.includes('www.wikidata.org') && wdCalls.includes('query.wikidata.org'), 'both Wikidata endpoints used');
  assert.deepEqual(problems, [], 'no console errors or CSP violations');
  console.log('e2e: all checks passed');
} catch (err) {
  if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'failure.png') }).catch(() => {});
  console.error(problems.join('\n'));
  throw err;
} finally {
  await browser.close();
  server.close();
}
