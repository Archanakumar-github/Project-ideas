// Exodus — data layer.
// Pure functions over one plain JSON document. No DOM, so it runs in Node tests too.
//
//   items   one log per film / series (type, title, year, tags, watch status)
//   cats    lists and sub-lists (a tree via `parent`); `fav` is the built-in Favorites list
//   places  an item's membership in one list, with its own position and an optional
//           list-specific override of title / year / tags (`o`). Editing or removing a
//           place never touches the item's other lists.

export const FAV = 'fav';
export const MAX_DEPTH = 3; // list › sub-list › sub-sub-list
export const SORTS = ['manual', 'title', 'year', 'year-desc', 'recent'];

const ID_RE = /^[a-z0-9]{1,32}$/i;
const has = (o, k) => typeof k === 'string' && Object.hasOwn(o, k);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const entriesOf = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? Object.entries(o) : []);
const now = () => Date.now();

export function uid() {
  const bytes = new Uint8Array(10);
  crypto.getRandomValues(bytes);
  let s = '';
  for (const b of bytes) s += (b % 36).toString(36);
  return s;
}

function favCat() {
  return { id: FAV, name: 'Favorites', parent: null, kind: 'list', link: false, sort: 'manual', order: -1, sys: true, t: 0 };
}

export function createDB() {
  return { v: 1, items: {}, cats: { [FAV]: favCat() }, places: {} };
}

/* ---------- cleaning ---------- */

const CTRL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g;

export function cleanText(s, max) {
  return String(s ?? '').replace(CTRL, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}
export const cleanTitle = (s) => cleanText(s, 160);
export const cleanName = (s) => cleanText(s, 48);

export function cleanYear(y) {
  const s = String(y ?? '').trim();
  if (!/^\d{4}$/.test(s)) return '';
  const n = Number(s);
  return n >= 1870 && n <= 2100 ? s : '';
}

export function cleanTags(input) {
  const raw = Array.isArray(input) ? input : String(input ?? '').split(',');
  const out = [];
  const seen = new Set();
  for (const t of raw) {
    const tag = cleanText(String(t ?? '').replace(/^[\s#[(]+|[\])\s]+$/g, ''), 24);
    const key = tag.toLowerCase();
    if (tag && !seen.has(key)) {
      seen.add(key);
      out.push(tag);
    }
    if (out.length >= 8) break;
  }
  return out;
}

/** Lower-case, accent-free, punctuation-free form used for search and duplicate checks. */
export function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
const sortKey = (title) => norm(title).replace(/^(the|a|an) /, '');
export const cmpTitle = (a, b) => collator.compare(sortKey(a), sortKey(b));

/* ---------- reading ---------- */

const byPos = (a, b) => a.pos - b.pos || a.t - b.t;

/** Lookup tables for one render pass. */
export function buildIndex(db) {
  const byCat = new Map();
  const byItem = new Map();
  const kids = new Map();
  const push = (m, k, v) => {
    const a = m.get(k);
    if (a) a.push(v);
    else m.set(k, [v]);
  };
  for (const p of Object.values(db.places)) {
    push(byCat, p.cat, p);
    push(byItem, p.item, p);
  }
  for (const a of byCat.values()) a.sort(byPos);
  for (const c of Object.values(db.cats)) push(kids, c.parent || '', c);
  for (const a of kids.values()) a.sort((x, y) => (y.sys ? 1 : 0) - (x.sys ? 1 : 0) || x.order - y.order || x.t - y.t);
  return { byCat, byItem, kids };
}

/** Title / year / tags as shown in one list (the list's own override wins). */
export function view(item, place) {
  const o = place && place.o;
  return o ? { title: o.title, year: o.year, tags: o.tags } : { title: item.title, year: item.year, tags: item.tags };
}

export function rootOf(db, catId) {
  let c = db.cats[catId];
  for (let i = 0; c && c.parent && has(db.cats, c.parent) && i < 10; i++) c = db.cats[c.parent];
  return c;
}

export function depthOf(db, catId) {
  let d = 0;
  for (let c = db.cats[catId]; c && c.parent && has(db.cats, c.parent) && d < 10; c = db.cats[c.parent]) d++;
  return d;
}

export function pathOf(db, catId) {
  const parts = [];
  for (let c = db.cats[catId], i = 0; c && i < 10; c = c.parent ? db.cats[c.parent] : null, i++) parts.unshift(c.name);
  return parts.join(' / ');
}

export function subtreeIds(db, catId) {
  const out = [catId];
  const all = Object.values(db.cats);
  for (let i = 0; i < out.length; i++) for (const c of all) if (c.parent === out[i]) out.push(c.id);
  return out;
}

/** Settings that sub-lists inherit from their top-level list. */
export function effective(db, cat) {
  const root = rootOf(db, cat.id) || cat;
  const timeline = root.kind === 'timeline';
  return {
    root,
    timeline,
    link: !!root.link,
    sort: timeline ? 'manual' : SORTS.includes(cat.sort) ? cat.sort : 'manual',
  };
}

export function sortPlaces(db, places, sort) {
  const arr = places.slice();
  const v = (p) => view(db.items[p.item], p);
  const yr = (p, empty) => Number(v(p).year) || empty;
  switch (sort) {
    case 'title':
      return arr.sort((a, b) => cmpTitle(v(a).title, v(b).title));
    case 'year':
      return arr.sort((a, b) => yr(a, 1e5) - yr(b, 1e5) || cmpTitle(v(a).title, v(b).title));
    case 'year-desc':
      return arr.sort((a, b) => yr(b, -1) - yr(a, -1) || cmpTitle(v(a).title, v(b).title));
    case 'recent':
      return arr.sort((a, b) => b.t - a.t || b.pos - a.pos);
    default:
      return arr.sort(byPos);
  }
}

export function placesOf(db, itemId) {
  return Object.values(db.places).filter((p) => p.item === itemId);
}

export function findPlace(db, itemId, catId) {
  for (const p of Object.values(db.places)) if (p.item === itemId && p.cat === catId) return p;
  return null;
}

export const isFav = (db, itemId) => !!findPlace(db, itemId, FAV);

/** Existing log with the same title, type and (when both are known) year. */
export function findExact(db, { title, year = '', type = 'movie' }) {
  const n = norm(title);
  const y = cleanYear(year);
  if (!n) return null;
  for (const it of Object.values(db.items)) {
    if (it.type === type && norm(it.title) === n && (!y || !it.year || it.year === y)) return it;
  }
  return null;
}

/** Type-ahead matches for the add sheet. */
export function findMatches(db, text, type, limit = 4) {
  const q = norm(text);
  if (q.length < 2) return [];
  const hits = [];
  for (const it of Object.values(db.items)) {
    const n = norm(it.title);
    const at = n.indexOf(q);
    if (at < 0) continue;
    hits.push({ it, score: (n === q ? 0 : at === 0 ? 1 : 2) + (it.type === type ? 0 : 3) });
  }
  return hits
    .sort((a, b) => a.score - b.score || cmpTitle(a.it.title, b.it.title))
    .slice(0, limit)
    .map((h) => h.it);
}

/** Every tag in use, most used first. */
export function allTags(db) {
  const count = new Map();
  const add = (tags) => {
    for (const t of tags) {
      const k = t.toLowerCase();
      const cur = count.get(k);
      if (cur) cur.n++;
      else count.set(k, { tag: t, n: 1 });
    }
  };
  for (const it of Object.values(db.items)) add(it.tags);
  for (const p of Object.values(db.places)) if (p.o) add(p.o.tags);
  return [...count.values()].sort((a, b) => b.n - a.n || collator.compare(a.tag, b.tag)).map((x) => x.tag);
}

/* ---------- parsing ---------- */

const YEAR_TAIL = /^(.*?)(?:\s*[([]\s*((?:18|19|20|21)\d{2})\s*[)\]]|\s*[,|–—-]\s*((?:18|19|20|21)\d{2}))\s*$/;

/**
 * "Dune (2021)", "Dune [2021]", "Dune, 2021", "Dune - 2021" → { title: 'Dune', year: '2021' }.
 * A bare trailing number is left alone, so "Blade Runner 2049" stays intact.
 */
export function parseTitleYear(s) {
  const str = cleanTitle(s);
  const m = str.match(YEAR_TAIL);
  if (m && m[1].trim()) {
    const year = cleanYear(m[2] || m[3]);
    if (year) return { title: m[1].trim(), year };
  }
  return { title: str, year: '' };
}

const TYPE_TAG = /\s*[[(]\s*(tv series|tv show|tv|series|show|mini-?series|film|movie)\s*[\])]\s*/i;
const TYPE_PREFIX = /^(tv|series|show|film|movie)\s*:\s*/i;
const typeWord = (w) => (/^(film|movie)$/i.test(w) ? 'movie' : 'tv');

/**
 * One title per line. Understands list markers ("1.", "-", "•"), years ("(2008)", ", 2008"),
 * type markers ("[tv]", "(series)", "tv:", "film:") and tab-separated spreadsheet rows.
 */
export function parseBulk(text, defType = 'movie') {
  const out = [];
  for (let line of String(text ?? '').split(/\r?\n/)) {
    line = line.replace(/^\s*(?:[-*•·–]\s+|\d{1,3}[.)]\s+)/, '').trim();
    if (!line) continue;
    let type = defType === 'tv' ? 'tv' : 'movie';
    let year = '';
    if (line.includes('\t')) {
      const cols = line.split('\t').map((c) => c.trim()).filter(Boolean);
      line = cols.shift() || '';
      for (const c of cols) {
        if (!year && cleanYear(c)) year = c;
        else if (/^(tv|series|show|tv series)$/i.test(c)) type = 'tv';
        else if (/^(film|movie)$/i.test(c)) type = 'movie';
      }
    }
    let m = line.match(TYPE_PREFIX);
    if (m) {
      type = typeWord(m[1]);
      line = line.slice(m[0].length);
    }
    m = line.match(TYPE_TAG);
    if (m) {
      type = typeWord(m[1]);
      line = `${line.slice(0, m.index)} ${line.slice(m.index + m[0].length)}`.trim();
    }
    const ty = parseTitleYear(line);
    if (!ty.title) continue;
    out.push({ title: ty.title, year: year || ty.year, type });
    if (out.length >= 500) break;
  }
  return out;
}

/* ---------- items ---------- */

export function addItem(db, data) {
  const title = cleanTitle(data.title);
  if (!title) throw new Error('A title is required');
  const t = now();
  const item = {
    id: uid(),
    type: data.type === 'tv' ? 'tv' : 'movie',
    title,
    year: cleanYear(data.year),
    tags: cleanTags(data.tags),
    status: data.status === 'watched' ? 'watched' : 'want',
    t,
    u: t,
  };
  db.items[item.id] = item;
  return item;
}

const sameDetails = (a, b) =>
  a.title === b.title && a.year === b.year && a.tags.length === b.tags.length && a.tags.every((t, i) => t === b.tags[i]);

/**
 * Edit title / year / tags.
 * With `placeId`, the change is stored on that one list only; every other list keeps its version.
 * Without it, the shared log changes and every list-specific override is cleared.
 */
export function editItem(db, itemId, patch, placeId = null) {
  const it = db.items[itemId];
  if (!it) return;
  const next = { title: cleanTitle(patch.title), year: cleanYear(patch.year), tags: cleanTags(patch.tags) };
  if (!next.title) throw new Error('A title is required');
  const p = placeId && has(db.places, placeId) ? db.places[placeId] : null;
  if (p && p.item === itemId) {
    if (sameDetails(next, it)) delete p.o;
    else p.o = next;
  } else {
    Object.assign(it, next);
    for (const q of placesOf(db, itemId)) delete q.o;
  }
  it.u = now();
}

export function resetOverride(db, placeId) {
  if (has(db.places, placeId)) delete db.places[placeId].o;
}

export function setStatus(db, itemId, status) {
  const it = db.items[itemId];
  if (!it) return;
  it.status = status === 'watched' ? 'watched' : 'want';
  it.u = now();
}

export function setType(db, itemId, type) {
  const it = db.items[itemId];
  if (!it) return;
  it.type = type === 'tv' ? 'tv' : 'movie';
  it.u = now();
}

export function deleteItem(db, itemId) {
  for (const p of placesOf(db, itemId)) delete db.places[p.id];
  delete db.items[itemId];
}

/* ---------- membership ---------- */

export function addPlace(db, itemId, catId) {
  if (!has(db.items, itemId) || !has(db.cats, catId)) return null;
  const existing = findPlace(db, itemId, catId);
  if (existing) return existing;
  let max = -1;
  for (const p of Object.values(db.places)) if (p.cat === catId && p.pos > max) max = p.pos;
  const p = { id: uid(), item: itemId, cat: catId, pos: max + 1, t: now() };
  db.places[p.id] = p;
  return p;
}

export function removePlace(db, placeId) {
  delete db.places[placeId];
}

export function setMember(db, itemId, catId, on) {
  if (on) return addPlace(db, itemId, catId);
  const p = findPlace(db, itemId, catId);
  if (p) delete db.places[p.id];
  return null;
}

export function toggleFav(db, itemId) {
  const on = !isFav(db, itemId);
  setMember(db, itemId, FAV, on);
  return on;
}

/**
 * Re-order a list. `ids` may be a subset (e.g. only the films of a mixed list):
 * those places take over each other's slots and everything else stays put.
 */
export function reorder(db, catId, ids) {
  const all = Object.values(db.places).filter((p) => p.cat === catId).sort(byPos);
  const wanted = ids.filter((id) => has(db.places, id) && db.places[id].cat === catId);
  const set = new Set(wanted);
  let k = 0;
  all.map((p) => (set.has(p.id) ? db.places[wanted[k++]] : p)).forEach((p, i) => {
    p.pos = i;
  });
}

/** Freeze the current visual order into manual positions (used when switching a list to custom order). */
export function materialize(db, catId, sort) {
  const all = Object.values(db.places).filter((p) => p.cat === catId);
  sortPlaces(db, all, sort).forEach((p, i) => {
    p.pos = i;
  });
}

/* ---------- lists ---------- */

export function addCat(db, { name, parent = null, kind = 'list' }) {
  const nm = cleanName(name);
  if (!nm) throw new Error('A list name is required');
  if (parent) {
    const pc = has(db.cats, parent) ? db.cats[parent] : null;
    if (!pc) throw new Error('That list no longer exists');
    if (pc.sys) throw new Error('Favorites can’t have sub-lists');
    if (depthOf(db, parent) >= MAX_DEPTH - 1) throw new Error('Lists nest up to three levels');
  }
  let order = 0;
  for (const c of Object.values(db.cats)) if (!c.sys && (c.parent || null) === (parent || null)) order = Math.max(order, c.order + 1);
  const timeline = !parent && kind === 'timeline';
  const c = { id: uid(), name: nm, parent: parent || null, kind: timeline ? 'timeline' : 'list', link: timeline, sort: 'manual', order, t: now() };
  db.cats[c.id] = c;
  return c;
}

/** "MCU / Phase Seven" → finds or creates each level and returns the last one. */
export function ensurePath(db, path, kind = 'list') {
  const parts = String(path ?? '').split('/').map(cleanName).filter(Boolean).slice(0, MAX_DEPTH);
  if (!parts.length) throw new Error('A list name is required');
  let parent = null;
  let cat = null;
  parts.forEach((part, i) => {
    const key = part.toLowerCase();
    cat = Object.values(db.cats).find((c) => !c.sys && (c.parent || null) === parent && c.name.toLowerCase() === key);
    if (!cat) cat = addCat(db, { name: part, parent, kind: i === 0 ? kind : 'list' });
    parent = cat.id;
  });
  return cat;
}

export function updateCat(db, catId, patch) {
  const c = has(db.cats, catId) ? db.cats[catId] : null;
  if (!c) return;
  if ('name' in patch) {
    const nm = cleanName(patch.name);
    if (!nm) throw new Error('A list name is required');
    c.name = nm;
  }
  const top = !c.parent && !c.sys;
  if ('kind' in patch && top) {
    const next = patch.kind === 'timeline' ? 'timeline' : 'list';
    if (next === 'timeline' && c.kind !== 'timeline') for (const id of subtreeIds(db, c.id)) materialize(db, id, effective(db, db.cats[id]).sort);
    c.kind = next;
  }
  if ('link' in patch && top) c.link = !!patch.link;
  if ('sort' in patch && SORTS.includes(patch.sort)) {
    if (patch.sort === 'manual' && c.sort !== 'manual') materialize(db, c.id, c.sort);
    c.sort = patch.sort;
  }
}

/** Move a list up (-1) or down (+1) among its siblings. */
export function moveCat(db, catId, dir) {
  const c = db.cats[catId];
  if (!c || c.sys) return;
  const sibs = Object.values(db.cats)
    .filter((x) => !x.sys && (x.parent || null) === (c.parent || null))
    .sort((a, b) => a.order - b.order || a.t - b.t);
  const i = sibs.indexOf(c);
  const j = i + dir;
  if (j < 0 || j >= sibs.length) return;
  [sibs[i], sibs[j]] = [sibs[j], sibs[i]];
  sibs.forEach((x, k) => {
    x.order = k;
  });
}

/**
 * Delete a list and its sub-lists. Titles stay in their other lists; titles left in no list
 * become Unsorted, or are deleted too when `purge` is set. Returns how many logs were purged.
 */
export function deleteCat(db, catId, { purge = false } = {}) {
  if (!has(db.cats, catId) || db.cats[catId].sys) return 0;
  const ids = new Set(subtreeIds(db, catId));
  const touched = new Set();
  for (const p of Object.values(db.places)) {
    if (ids.has(p.cat)) {
      touched.add(p.item);
      delete db.places[p.id];
    }
  }
  for (const id of ids) delete db.cats[id];
  let purged = 0;
  if (purge) {
    const placed = new Set(Object.values(db.places).map((p) => p.item));
    for (const itemId of touched) {
      if (!placed.has(itemId)) {
        delete db.items[itemId];
        purged++;
      }
    }
  }
  return purged;
}

/** Count of titles only reachable through this list (what `purge` would delete). */
export function exclusiveCount(db, catId) {
  const ids = new Set(subtreeIds(db, catId));
  const inside = new Set();
  const outside = new Set();
  for (const p of Object.values(db.places)) (ids.has(p.cat) ? inside : outside).add(p.item);
  let n = 0;
  for (const id of inside) if (!outside.has(id)) n++;
  return n;
}

/* ---------- templates ---------- */

export function applyTemplate(db, tpl) {
  let name = tpl.name;
  const taken = (n) => Object.values(db.cats).some((c) => !c.parent && c.name.toLowerCase() === n.toLowerCase());
  for (let i = 2; taken(name); i++) name = `${tpl.name} ${i}`;
  const root = addCat(db, { name, kind: tpl.kind || 'timeline' });
  const added = [];
  for (const [groupName, entries] of tpl.groups) {
    const g = addCat(db, { name: groupName, parent: root.id });
    for (const [title, year, type = 'movie'] of entries) {
      let it = findExact(db, { title, year: String(year), type });
      if (!it) it = addItem(db, { title, year: String(year), type, status: 'want' });
      addPlace(db, it.id, g.id);
      added.push(it.id);
    }
  }
  return { root, added };
}

/* ---------- backup ---------- */

/** Rebuild a library from untrusted JSON: unknown fields dropped, strings bounded, links checked. */
export function sanitizeDB(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Not an Exodus library');
  const db = createDB();

  for (const [id, it] of entriesOf(raw.items)) {
    if (!ID_RE.test(id) || !it || typeof it !== 'object') continue;
    const title = cleanTitle(it.title);
    if (!title) continue;
    db.items[id] = {
      id,
      type: it.type === 'tv' ? 'tv' : 'movie',
      title,
      year: cleanYear(it.year),
      tags: cleanTags(it.tags),
      status: it.status === 'watched' ? 'watched' : 'want',
      t: num(it.t),
      u: num(it.u),
    };
  }

  for (const [id, c] of entriesOf(raw.cats)) {
    if (!c || typeof c !== 'object') continue;
    if (id === FAV) {
      const nm = cleanName(c.name);
      if (nm) db.cats[FAV].name = nm;
      continue;
    }
    if (!ID_RE.test(id)) continue;
    const name = cleanName(c.name);
    if (!name) continue;
    db.cats[id] = {
      id,
      name,
      parent: typeof c.parent === 'string' ? c.parent : null,
      kind: c.kind === 'timeline' ? 'timeline' : 'list',
      link: !!c.link,
      sort: SORTS.includes(c.sort) ? c.sort : 'manual',
      order: num(c.order),
      t: num(c.t),
    };
  }
  for (const c of Object.values(db.cats)) {
    if (c.sys || !c.parent) continue;
    if (!has(db.cats, c.parent) || c.parent === FAV || c.parent === c.id) c.parent = null;
  }
  for (const c of Object.values(db.cats)) {
    const seen = new Set([c.id]);
    for (let p = c.parent, d = 0; p; p = db.cats[p] ? db.cats[p].parent : null) {
      if (seen.has(p) || ++d >= MAX_DEPTH) {
        c.parent = null;
        break;
      }
      seen.add(p);
    }
  }

  const pairs = new Set();
  for (const [id, p] of entriesOf(raw.places)) {
    if (!ID_RE.test(id) || !p || typeof p !== 'object') continue;
    if (!has(db.items, p.item) || !has(db.cats, p.cat)) continue;
    const key = `${p.item}|${p.cat}`;
    if (pairs.has(key)) continue;
    pairs.add(key);
    const place = { id, item: p.item, cat: p.cat, pos: num(p.pos), t: num(p.t) };
    if (p.o && typeof p.o === 'object') {
      const title = cleanTitle(p.o.title);
      if (title) place.o = { title, year: cleanYear(p.o.year), tags: cleanTags(p.o.tags) };
    }
    db.places[id] = place;
  }
  return db;
}

/** Union of two libraries: newer edits win, nothing is removed. */
export function mergeDB(base, incoming) {
  const out = JSON.parse(JSON.stringify(base));
  for (const it of Object.values(incoming.items)) {
    const cur = out.items[it.id];
    if (!cur || (it.u || 0) > (cur.u || 0)) out.items[it.id] = { ...it, tags: [...it.tags] };
  }
  for (const c of Object.values(incoming.cats)) if (!c.sys && !has(out.cats, c.id)) out.cats[c.id] = { ...c };
  const pairs = new Set(Object.values(out.places).map((p) => `${p.item}|${p.cat}`));
  for (const p of Object.values(incoming.places)) {
    const key = `${p.item}|${p.cat}`;
    if (pairs.has(key)) continue;
    pairs.add(key);
    const id = has(out.places, p.id) ? uid() : p.id;
    out.places[id] = { ...p, id };
  }
  return sanitizeDB(out);
}

export function stats(db) {
  const s = { movie: 0, tv: 0, movieW: 0, tvW: 0, lists: 0 };
  for (const it of Object.values(db.items)) {
    s[it.type]++;
    if (it.status === 'watched') s[`${it.type}W`]++;
  }
  for (const c of Object.values(db.cats)) if (!c.sys) s.lists++;
  return s;
}
