// exodus. — optional online lookup (Wikidata: free, no account, no API key).
// Only the title being searched is sent. Results are cached on the device so a lookup done
// once still works offline. Everything here fails soft: no network → no suggestions.

const API = 'https://www.wikidata.org/w/api.php';
const SPARQL = 'https://query.wikidata.org/sparql';
const CACHE_KEY = 'exodus:webcache';
const CACHE_MAX = 300;
const TIMEOUT = 7000;
export const REF_RE = /^Q\d{1,12}$/;

/* ---------- pure helpers (unit-tested) ---------- */

const NOT_A_TITLE = /\b(director|actor|actress|producer|screenwriter|cinematographer|composer|critic|festival|studio|company|distributor|character|soundtrack|album|song|single|novel|book|comic|manga|video game|film series|franchise|episode|season|award|cinema of|list of|television channel|network|station|journalist|politician|footballer|musician|singer|rapper|band)\b/;

/** Wikidata's one-line description → { type, year } or null when it isn't a film or a series. */
export function classify(description) {
  const d = String(description || '').toLowerCase();
  if (!d || NOT_A_TITLE.test(d)) return null;
  let type = null;
  if (/\b(miniseries|mini-series|sitcom|soap opera|telenovela|anime series|tv series|television series|television program(me)?|television show|web series|streaming series|docuseries)\b/.test(d)) type = 'tv';
  else if (/\b(film|movie|documentary|animated feature|short film)\b/.test(d)) type = 'movie';
  if (!type) return null;
  const y = d.match(/\b(18[89]\d|19\d\d|20\d\d)\b/);
  return { type, year: y ? y[1] : '' };
}

const GENRE_ALIASES = {
  'science fiction': 'Sci-Fi',
  'science fiction action': 'Sci-Fi Action',
  'speculative fiction': 'Speculative',
  'romantic comedy': 'Rom-Com',
  'superhero': 'Superhero',
  'neo-noir': 'Neo-Noir',
  'film noir': 'Noir',
};

/** "science fiction film" → "Sci-Fi", "drama television series" → "Drama". Generic labels are dropped. */
export function cleanGenre(label) {
  let g = String(label || '').toLowerCase().trim();
  g = g.replace(/\b(feature film|film|movie|television series|television program(me)?|tv series|web series|anime|series|genre)$/g, '').trim();
  g = g.replace(/\b(film|television|tv)$/g, '').trim();
  if (/based on|adaptation|^film |^films? about|^works? /.test(g)) return '';
  if (!g || /^(fiction|drama fiction|narrative|live-action|feature|independent|television|lgbt-related)$/.test(g)) return g === 'drama fiction' ? 'Drama' : '';
  if (GENRE_ALIASES[g]) return GENRE_ALIASES[g];
  if (g.length > 24) return '';
  return g.replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase());
}

export function cleanGenres(labels, max = 4) {
  const out = [];
  for (const l of labels) {
    const g = cleanGenre(l);
    if (g && !out.some((x) => x.toLowerCase() === g.toLowerCase())) out.push(g);
    if (out.length >= max) break;
  }
  return out;
}

/** Turn a wbsearchentities response into film/series candidates. */
export function parseSearch(json, limit = 6) {
  const out = [];
  for (const r of (json && json.search) || []) {
    if (!REF_RE.test(r.id || '')) continue;
    const c = classify(r.description);
    if (!c) continue;
    const title = String(r.label || r.match?.text || '').trim().slice(0, 160);
    if (!title) continue;
    out.push({ ref: r.id, title, year: c.year, type: c.type, note: String(r.description || '').slice(0, 90) });
    if (out.length >= limit) break;
  }
  return out;
}

/** Turn the details SPARQL response into { year, genres, countries }. */
export function parseDetails(json) {
  const b = json && json.results && json.results.bindings && json.results.bindings[0];
  if (!b) return { year: '', genres: [], countries: [] };
  const split = (k) => (b[k] && b[k].value ? b[k].value.split('|').filter(Boolean) : []);
  const date = b.date && b.date.value ? b.date.value : '';
  const y = date.match(/^\+?(\d{4})/);
  return {
    year: y ? y[1] : '',
    genres: cleanGenres(split('genres')),
    countries: split('countries').slice(0, 3),
  };
}

/* ---------- cache ---------- */

function readCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY));
    return c && typeof c === 'object' ? c : {};
  } catch {
    return {};
  }
}

function cacheGet(key) {
  const c = readCache();
  return Object.hasOwn(c, key) ? c[key].v : undefined;
}

function cacheSet(key, v) {
  try {
    const c = readCache();
    c[key] = { v, t: Date.now() };
    const keys = Object.keys(c);
    if (keys.length > CACHE_MAX) keys.sort((a, b) => c[a].t - c[b].t).slice(0, keys.length - CACHE_MAX).forEach((k) => delete c[k]);
    localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* the cache is a nicety */
  }
}

export function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

/* ---------- network ---------- */

async function getJSON(url, signal) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  const onAbort = () => ctrl.abort();
  if (signal) signal.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, { signal: ctrl.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
    if (signal) signal.removeEventListener('abort', onAbort);
  }
}

export const isOnline = () => navigator.onLine !== false;

/**
 * Search films and series by title. Resolves to { results, source: 'web' | 'cache' | 'offline' }.
 * Throws only for real network errors while online (so the UI can say "lookup unavailable").
 */
export async function searchTitles(query, signal) {
  const q = String(query || '').trim().slice(0, 120);
  if (q.length < 2) return { results: [], source: 'cache' };
  const key = `s:${q.toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached) return { results: cached, source: 'cache' };
  if (!isOnline()) return { results: [], source: 'offline' };
  const url = `${API}?${new URLSearchParams({ action: 'wbsearchentities', search: q, language: 'en', uselang: 'en', type: 'item', limit: '20', format: 'json', origin: '*' })}`;
  const results = parseSearch(await getJSON(url, signal));
  cacheSet(key, results);
  return { results, source: 'web' };
}

/** Release year, genres and countries for one Wikidata item. */
export async function fetchDetails(ref, signal) {
  if (!REF_RE.test(ref)) throw new Error('Bad reference');
  const key = `d:${ref}`;
  const cached = cacheGet(key);
  if (cached) return cached;
  if (!isOnline()) return null;
  const query = `SELECT (MIN(?d) AS ?date) (GROUP_CONCAT(DISTINCT ?gl; separator="|") AS ?genres) (GROUP_CONCAT(DISTINCT ?cl; separator="|") AS ?countries) WHERE {
  OPTIONAL { wd:${ref} wdt:P577|wdt:P580 ?d . }
  OPTIONAL { wd:${ref} wdt:P136 ?g . ?g rdfs:label ?gl . FILTER(LANG(?gl) = "en") }
  OPTIONAL { wd:${ref} wdt:P495 ?c . ?c rdfs:label ?cl . FILTER(LANG(?cl) = "en") }
}`;
  const details = parseDetails(await getJSON(`${SPARQL}?${new URLSearchParams({ query, format: 'json' })}`, signal));
  cacheSet(key, details);
  return details;
}

export const refUrl = (ref) => (REF_RE.test(ref) ? `https://www.wikidata.org/wiki/${ref}` : '');
