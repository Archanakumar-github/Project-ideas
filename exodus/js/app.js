// exodus. — UI layer
import { h, $ } from './dom.js';
import * as M from './model.js';
import { vault } from './vault.js';
import { TEMPLATES } from './starter.js';
import * as W from './lookup.js';

const PREFS_KEY = 'exodus:prefs';
const FAILS_KEY = 'exodus:lockfails';
const TYPE_LABEL = { movie: 'FILM', tv: 'SERIES' };
const TAB_LABEL = { movie: 'MOVIES', tv: 'TV SERIES' };
const STATUS_LABEL = { all: 'ALL', watched: 'WATCHED', want: 'TO WATCH' };
const SORT_LABEL = { manual: 'CUSTOM', title: 'A–Z', year: 'YEAR ↑', 'year-desc': 'YEAR ↓', recent: 'RECENT' };
const AUTOLOCK = [[0, 'AT ONCE'], [1, '1 MIN'], [5, '5 MIN'], [15, '15 MIN']];
const ACT_W = 148;
const IS_IOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

let db = null;
const prefs = readPrefs();
const ui = {
  tab: prefs.tab === 'tv' ? 'tv' : 'movie',
  status: ['all', 'watched', 'want'].includes(prefs.status) ? prefs.status : 'all',
  q: '',
  folded: new Set(Array.isArray(prefs.folded) ? prefs.folded : []),
  reorder: null,
  flash: new Set(),
};

const E = {
  html: document.documentElement,
  top: $('#top'),
  list: $('#list'),
  q: $('#q'),
  qx: $('#qx'),
  tabs: $('#tabs'),
  filters: $('#filters'),
  fold: $('#foldAll'),
  tot: $('#tot'),
  menu: $('#menuBtn'),
  fab: $('#fab'),
  scrim: $('#scrim'),
  sheet: $('#sheet'),
  sbody: $('#sbody'),
  grab: $('#grab'),
  toast: $('#toast'),
  kb: $('#kbproxy'),
  file: $('#file'),
  lock: $('#lock'),
  lockForm: $('#lockForm'),
  lockPass: $('#lockPass'),
  lockGo: $('#lockGo'),
  lockErr: $('#lockErr'),
  lockReset: $('#lockReset'),
};

/* ================= prefs & persistence ================= */

function readPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY));
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

function savePrefs() {
  prefs.tab = ui.tab;
  prefs.status = ui.status;
  prefs.folded = [...ui.folded].filter((id) => id === 'loose' || (db && db.cats[id]));
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* prefs are a nicety */
  }
}

let saveChain = Promise.resolve();
let lastSaved = 0;
let storagePersisted = null;
let saveQueued = false;
function persist() {
  saveQueued = true;
  saveChain = saveChain.then(async () => {
    if (!saveQueued || !db) return;
    saveQueued = false;
    try {
      await vault.save(db);
      lastSaved = Date.now();
    } catch {
      toast('Could not save — storage may be full. Export a backup from the menu.');
    }
  });
  return saveChain;
}

/** Apply a change, save, redraw. With `undoLabel` (text, or a function of the result), the toast offers UNDO. */
function commit(fn, undoLabel) {
  const snap = undoLabel ? JSON.stringify(db) : null;
  let out;
  try {
    out = fn(db);
  } catch (err) {
    toast(err && err.message ? err.message : 'Something went wrong');
    return undefined;
  }
  persist();
  render();
  refreshSheet();
  if (undoLabel) {
    toast(typeof undoLabel === 'function' ? undoLabel(out) : undoLabel, {
      label: 'UNDO',
      run: () => {
        db = JSON.parse(snap);
        persist();
        render();
        refreshSheet();
        toast('Undone');
      },
    });
  }
  return out;
}

/** replaceChildren() would print "null" for empty slots — drop them first. */
function put(el, ...kids) {
  el.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));
}

/* ================= toast ================= */

let toastTimer = 0;
function toast(msg, action) {
  put(E.toast,
    h('span', { class: 'msg' }, msg),
    action
      ? h('button', { type: 'button', onclick: () => { hideToast(); action.run(); } }, action.label)
      : null,
  );
  E.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 6000 : 2600);
}
function hideToast() {
  E.toast.classList.remove('show');
}

/* ================= small widgets ================= */

function seg(options, value, onChange, label) {
  const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label || 'Options' });
  const paint = (v) => {
    for (const b of wrap.children) b.setAttribute('aria-checked', String(b.dataset.v === v));
  };
  for (const [v, text] of options) {
    wrap.append(
      h('button', {
        type: 'button',
        role: 'radio',
        dataset: { v },
        onclick: () => {
          if (wrap.querySelector('[aria-checked="true"]')?.dataset.v === v) return;
          paint(v);
          onChange(v);
        },
      }, text),
    );
  }
  paint(value);
  wrap.set = paint;
  return wrap;
}

function label(text, aside) {
  return h('div', { class: 'lbl' }, h('span', null, text), h('span', { class: 'rule' }), aside ? (aside instanceof Node ? aside : h('span', { class: 'aside' }, aside)) : null);
}

function field(k, input) {
  return h('label', { class: 'field' }, k ? h('span', { class: 'k' }, k) : null, input);
}

function textInput(props = {}) {
  return h('input', {
    class: `in ${props.cls || ''}`,
    type: 'text',
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
    ...props,
    cls: null,
  });
}

function yearInput(value) {
  const el = textInput({ cls: 'mono', value, inputmode: 'numeric', pattern: '[0-9]*', maxlength: '4', placeholder: '—', 'aria-label': 'Year' });
  el.addEventListener('input', () => {
    const d = el.value.replace(/\D/g, '').slice(0, 4);
    if (d !== el.value) el.value = d;
  });
  return el;
}

function nudge(el) {
  const f = el.closest('.field') || el;
  f.classList.remove('bad');
  void f.offsetWidth;
  f.classList.add('bad');
  setTimeout(() => f.classList.remove('bad'), 1200);
}

/** Two-tap confirmation for destructive actions. */
function confirmAct(glyph, text, armedText, onConfirm, cls = 'act danger') {
  const t = h('span', null, text);
  const b = h('button', { type: 'button', class: cls }, h('span', { class: 'k' }, glyph), t);
  let armed = 0;
  let timer = 0;
  b.addEventListener('click', () => {
    if (armed && Date.now() - armed < 4000) {
      clearTimeout(timer);
      onConfirm();
      return;
    }
    armed = Date.now();
    t.textContent = armedText;
    b.classList.add('armed');
    timer = setTimeout(() => {
      armed = 0;
      t.textContent = text;
      b.classList.remove('armed');
    }, 4000);
  });
  return b;
}

function act(glyph, text, onClick, right, cls = 'act', sub = null) {
  return h('button', { type: 'button', class: cls, onclick: onClick },
    h('span', { class: 'k' }, glyph),
    h('span', { class: 't' }, text, sub ? h('span', { class: 'sub' }, sub) : null),
    right ? h('span', { class: 'r' }, right) : null);
}

/** Inline "+ new list" input. Supports "Parent / Child" paths. */
function newListRow(placeholder, onCreate) {
  const inp = textInput({ placeholder, enterkeyhint: 'done', maxlength: '120', 'aria-label': placeholder, autocapitalize: 'words' });
  const go = () => {
    const name = inp.value.trim();
    if (!name) return nudge(inp);
    onCreate(name);
    inp.value = '';
  };
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      go();
    }
  });
  return h('div', { class: 'newrow' }, h('span', { class: 'k' }, '+'), inp, h('button', { type: 'button', class: 'mini', onclick: go }, 'CREATE'));
}

/** Depth-first walk of the list tree (Favorites first). */
function walkTree(idx, fn, parent = '', depth = 0) {
  for (const c of idx.kids.get(parent) || []) {
    fn(c, depth);
    walkTree(idx, fn, c.id, depth + 1);
  }
}

function catLabel(c) {
  return c.sys ? [h('span', { class: 'star' }, '★ '), c.name] : c.name;
}

/* ================= rendering ================= */

let renderQueued = false;
function renderSoon() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    render();
  });
}

function render() {
  if (!db) return;
  const idx = M.buildIndex(db);
  const s = M.stats(db);
  renderChrome(s);
  renderList(idx, s);
  ui.flash.clear();
}

function renderChrome(s) {
  for (const b of E.tabs.querySelectorAll('[data-tab]')) {
    b.setAttribute('aria-selected', String(b.dataset.tab === ui.tab));
    b.querySelector('.n').textContent = s[b.dataset.tab];
  }
  E.tabs.dataset.active = ui.tab;
  const total = s[ui.tab];
  const watched = s[`${ui.tab}W`];
  const n = { all: total, watched, want: total - watched };
  for (const b of E.filters.querySelectorAll('[data-st]')) {
    b.setAttribute('aria-pressed', String(b.dataset.st === ui.status));
    b.querySelector('.n').textContent = n[b.dataset.st];
  }
  E.tot.textContent = `${s.movie + s.tv} LOGS`;
  E.qx.hidden = !ui.q;
  E.fold.textContent = foldRoots().every((id) => ui.folded.has(id)) ? 'UNFOLD ALL' : 'FOLD ALL';
  document.body.classList.toggle('reordering', !!ui.reorder);
}

function foldRoots() {
  return Object.values(db.cats).filter((c) => !c.parent).map((c) => c.id).concat('loose');
}

function matcher(terms) {
  return (it, p) => {
    if (ui.status !== 'all' && it.status !== ui.status) return false;
    if (!terms.length) return true;
    const v = M.view(it, p);
    const hay = M.norm(`${v.title} ${v.year} ${v.tags.join(' ')}`);
    return terms.every((t) => hay.includes(t));
  };
}

function renderList(idx) {
  const terms = M.norm(ui.q).split(' ').filter(Boolean);
  const ctx = {
    idx,
    terms,
    pass: matcher(terms),
    filtering: terms.length > 0 || ui.status !== 'all',
    favs: new Set((idx.byCat.get(M.FAV) || []).map((p) => p.item)),
  };
  const frag = document.createDocumentFragment();
  let rows = 0;
  for (const c of idx.kids.get('') || []) {
    const r = renderCat(c, 0, ctx, null);
    if (r) {
      frag.append(r.el);
      rows += r.rows;
    }
  }
  const loose = Object.values(db.items)
    .filter((it) => it.type === ui.tab && !idx.byItem.has(it.id) && ctx.pass(it, null))
    .sort((a, b) => M.cmpTitle(a.title, b.title));
  if (loose.length) {
    frag.append(looseSection(loose, ctx));
    rows += loose.length;
  }
  if (!rows && (ctx.filtering || !frag.childNodes.length)) frag.append(emptyState(ctx));
  E.list.replaceChildren(frag);
  openRow = null;
}

function visiblePlaces(cat, eff, idx) {
  return (idx.byCat.get(cat.id) || []).filter((p) => {
    const it = db.items[p.item];
    return it && (eff.link || it.type === ui.tab);
  });
}

function timelineNumbers(root, eff, idx) {
  const map = new Map();
  let n = 0;
  const walk = (c) => {
    for (const p of M.sortPlaces(db, visiblePlaces(c, eff, idx), 'manual')) map.set(p.id, ++n);
    for (const k of idx.kids.get(c.id) || []) walk(k);
  };
  walk(root);
  return map;
}

function subtreeHasPlaces(cat, idx) {
  if ((idx.byCat.get(cat.id) || []).length) return true;
  return (idx.kids.get(cat.id) || []).some((k) => subtreeHasPlaces(k, idx));
}

function renderCat(cat, depth, ctx, numbers) {
  const eff = M.effective(db, cat);
  if (depth === 0 && eff.timeline) numbers = timelineNumbers(cat, eff, ctx.idx);
  const shown = M.sortPlaces(db, visiblePlaces(cat, eff, ctx.idx), eff.sort).filter((p) => ctx.pass(db.items[p.item], p));

  const kids = [];
  let subRows = 0;
  for (const child of ctx.idx.kids.get(cat.id) || []) {
    const r = renderCat(child, depth + 1, ctx, numbers);
    if (r) {
      kids.push(r.el);
      subRows += r.rows;
    }
  }
  const total = shown.length + subRows;
  if (!total && !kids.length && (ctx.filtering || cat.sys || subtreeHasPlaces(cat, ctx.idx))) return null;

  const folded = ui.folded.has(cat.id) && !ctx.terms.length;
  const reordering = ui.reorder === eff.root.id;
  const sec = h('section', {
    class: `cat d${depth}${folded ? ' folded' : ''}${eff.timeline ? ' tl' : ''}${reordering ? ' reordering' : ''}`,
    dataset: { c: cat.id },
  });

  let actions;
  if (reordering) actions = depth === 0 ? h('button', { type: 'button', class: 'done', dataset: { act: 'done' } }, 'DONE') : null;
  else {
    actions = [
      h('button', { type: 'button', class: 'ib', dataset: { act: 'add' }, 'aria-label': `Add titles to ${cat.name}` }, '+'),
      h('button', { type: 'button', class: 'ib', dataset: { act: 'cat' }, 'aria-label': `${cat.name} options` }, '⋯'),
    ];
  }

  sec.append(
    h('header', { class: 'ch', dataset: { act: 'fold' }, role: 'button', 'aria-expanded': String(!folded) },
      h('span', { class: 'caret', 'aria-hidden': 'true' }, '▾'),
      depth ? h('span', { class: 'slash', 'aria-hidden': 'true' }, '/') : null,
      cat.sys ? h('span', { class: 'star', 'aria-hidden': 'true' }, '★') : null,
      h('span', { class: 'nm' }, cat.name),
      h('span', { class: 'ct' }, String(total)),
      depth === 0 && eff.timeline ? h('span', { class: 'badge' }, 'TIMELINE') : null,
      depth === 0 && eff.link ? h('span', { class: 'badge', title: 'Films and series shown together' }, 'FILM+TV') : null,
      h('span', { class: 'acts' }, actions),
    ),
  );

  const box = h('div', { class: 'rows' });
  const canDrag = reordering && eff.sort === 'manual';
  for (const p of shown) box.append(rowEl(db.items[p.item], p, cat, ctx, numbers ? numbers.get(p.id) : null, canDrag));
  if (!shown.length && !kids.length && !reordering) box.append(h('button', { type: 'button', class: 'hint', dataset: { act: 'add' } }, '+ add the first title'));
  sec.append(box, ...kids);
  return { el: sec, rows: total };
}

function rowEl(it, p, cat, ctx, num, canDrag) {
  const v = M.view(it, p);
  const tags = v.tags.slice(0, 2);
  const more = v.tags.length - tags.length;
  const watched = it.status === 'watched';
  return h('div', {
    class: `row${watched ? ' w' : ''}${ui.flash.has(it.id) ? ' flash' : ''}`,
    dataset: { i: it.id, p: p ? p.id : '', c: cat ? cat.id : '' },
  },
  h('div', { class: 'rc' },
    num != null ? h('span', { class: 'num' }, String(num).padStart(2, '0')) : null,
    h('button', {
      type: 'button',
      class: 'st',
      dataset: { act: 'status' },
      'aria-label': watched ? `${v.title}: watched. Mark as to watch` : `${v.title}: to watch. Mark as watched`,
    }),
    h('span', { class: 'tt' }, v.title),
    ctx.favs.has(it.id) && (!cat || !cat.sys) ? h('span', { class: 'fv', 'aria-label': 'Favorite' }, '★') : null,
    v.year ? h('span', { class: 'yr' }, v.year) : null,
    it.type !== ui.tab ? h('span', { class: 'xt' }, it.type === 'tv' ? 'TV' : 'FILM') : null,
    tags.length
      ? h('span', { class: 'tags' },
        h('span', null, `[${tags[0]}]`),
        tags[1] ? h('span', { class: 'x2' }, `[${tags[1]}]`) : null,
        more > 0 ? h('span', { class: 'more' }, `+${more}`) : null,
        v.tags.length > 1 ? h('span', { class: 'more mn' }, `+${v.tags.length - 1}`) : null)
      : null,
    canDrag ? h('span', { class: 'drag', dataset: { act: 'drag' }, 'aria-label': 'Drag to reorder' }, '≡') : null,
  ));
}

function looseSection(items, ctx) {
  const folded = ui.folded.has('loose') && !ctx.terms.length;
  const sec = h('section', { class: `cat d0 loose${folded ? ' folded' : ''}`, dataset: { c: 'loose' } },
    h('header', { class: 'ch', dataset: { act: 'fold' }, role: 'button', 'aria-expanded': String(!folded) },
      h('span', { class: 'caret', 'aria-hidden': 'true' }, '▾'),
      h('span', { class: 'nm' }, 'Unsorted'),
      h('span', { class: 'ct' }, String(items.length)),
      h('span', { class: 'acts' }, h('button', { type: 'button', class: 'ib', dataset: { act: 'new' }, 'aria-label': 'Add a title' }, '+')),
    ),
  );
  sec.append(h('div', { class: 'rows' }, items.map((it) => rowEl(it, null, null, ctx, null, false))));
  return sec;
}

function emptyState(ctx) {
  const kind = ui.tab === 'tv' ? 'series' : 'films';
  if (ctx.terms.length) {
    const other = ui.tab === 'tv' ? 'movie' : 'tv';
    const pass = matcher(ctx.terms);
    let n = 0;
    for (const it of Object.values(db.items)) if (it.type === other && pass(it, null)) n++;
    return h('div', { class: 'empty' },
      h('h2', null, 'NO MATCHES'),
      h('p', null, `Nothing in ${TAB_LABEL[ui.tab].toLowerCase()} matches “${ui.q}”.`),
      n ? h('div', { class: 'ctas' }, h('button', { type: 'button', class: 'btn sec', dataset: { act: 'other-tab' } }, `${n} IN ${TAB_LABEL[other]} →`)) : null,
    );
  }
  if (ui.status !== 'all') {
    return h('div', { class: 'empty' }, h('h2', null, `NOTHING ${STATUS_LABEL[ui.status]}`), h('p', null, `No ${kind} marked “${STATUS_LABEL[ui.status].toLowerCase()}” yet.`));
  }
  if (!Object.keys(db.items).length) {
    return h('div', { class: 'empty' },
      h('h2', null, 'AN EMPTY ARCHIVE'),
      h('p', null, 'Log films and series as plain text. One title can live in as many lists as you like.'),
      h('div', { class: 'ctas' },
        h('button', { type: 'button', class: 'btn pri', dataset: { act: 'new' } }, '+ LOG YOUR FIRST TITLE'),
        h('button', { type: 'button', class: 'btn sec', dataset: { act: 'tpl', t: 'mcu' } }, 'LOAD MCU TIMELINE'),
      ),
      h('p', { class: 'tiny' }, TEMPLATES.mcu.blurb),
    );
  }
  return h('div', { class: 'empty' },
    h('h2', null, `NO ${TAB_LABEL[ui.tab]} YET`),
    h('p', null, `Tap + to log your first ${ui.tab === 'tv' ? 'series' : 'film'}.`),
  );
}

/* ================= list interactions ================= */

let openRow = null;
let swipe = null;
let lastSwipe = -Infinity;
let swallowUntil = 0;

function rowCtx(row) {
  return { itemId: row.dataset.i, placeId: row.dataset.p || null, catId: row.dataset.c || null };
}

E.list.addEventListener('click', (e) => {
  if (performance.now() < swallowUntil || performance.now() - lastSwipe < 350) return;
  const actEl = e.target.closest('[data-act]');
  const a = actEl ? actEl.dataset.act : null;
  const row = e.target.closest('.row');
  const sec = e.target.closest('.cat');
  const catId = sec && sec.dataset.c !== 'loose' ? sec.dataset.c : null;

  if (openRow && row === openRow && (a === 'edit' || a === 'swipe-del')) {
    if (a === 'edit') {
      closeSwipe();
      openItem(row, true);
    } else swipeDelete(row);
    return;
  }
  if (row && ui.reorder) return;

  switch (a) {
    case 'status': return quickStatus(row);
    case 'fold': return toggleFold(sec.dataset.c);
    case 'add': return openAdd(catId);
    case 'cat': return catId && openSheet(() => catSheet(catId));
    case 'done': return exitReorder();
    case 'new': return openAdd(null);
    case 'tpl': return loadTemplate(actEl.dataset.t);
    case 'other-tab': return setTab(ui.tab === 'tv' ? 'movie' : 'tv');
    case 'drag': return undefined;
    default:
      if (row) openItem(row);
  }
  return undefined;
});

function openItem(row, focusEdit = false) {
  const { itemId, placeId, catId } = rowCtx(row);
  if (!db.items[itemId]) return;
  openSheet(() => itemSheet(itemId, placeId, catId, focusEdit));
}

function quickStatus(row) {
  const it = db.items[row.dataset.i];
  if (!it) return;
  const next = it.status === 'watched' ? 'want' : 'watched';
  commit((d) => M.setStatus(d, it.id, next), next === 'watched' ? `Watched · ${it.title}` : `Back to watch · ${it.title}`);
}

function toggleFold(id) {
  if (ui.folded.has(id)) ui.folded.delete(id);
  else ui.folded.add(id);
  savePrefs();
  render();
}

function swipeDelete(row) {
  const { itemId, placeId, catId } = rowCtx(row);
  const it = db.items[itemId];
  if (!it) return;
  const title = M.view(it, placeId ? db.places[placeId] : null).title;
  const many = placeId && M.placesOf(db, itemId).length > 1;
  row.classList.add('gone');
  setTimeout(() => {
    if (many) commit((d) => M.removePlace(d, placeId), `Removed “${title}” from ${db.cats[catId].name}`);
    else commit((d) => M.deleteItem(d, itemId), `Deleted “${title}”`);
  }, 200);
}

/* --- swipe left on a row: EDIT / REMOVE --- */

function ensureActions(row) {
  if (row.querySelector(':scope > .ra')) return;
  const { itemId, placeId } = rowCtx(row);
  const many = placeId && M.placesOf(db, itemId).length > 1;
  row.prepend(
    h('div', { class: 'ra' },
      h('button', { type: 'button', class: 'ra-edit', dataset: { act: 'edit' } }, 'EDIT'),
      h('button', { type: 'button', class: 'ra-del', dataset: { act: 'swipe-del' } }, many ? 'REMOVE' : 'DELETE'),
    ),
  );
}

function closeSwipe(row = openRow) {
  if (!row) return;
  const rc = row.querySelector(':scope > .rc');
  if (rc) rc.style.transform = '';
  if (row === openRow) openRow = null;
  setTimeout(() => {
    if (row !== openRow && !(swipe && swipe.row === row)) row.querySelector(':scope > .ra')?.remove();
  }, 360);
}

E.list.addEventListener('pointerdown', (e) => {
  if (e.target.closest('.drag')) {
    startDrag(e);
    return;
  }
  if (e.pointerType === 'mouse' || ui.reorder || e.target.closest('.ra')) return;
  const row = e.target.closest('.row');
  if (!row) return;
  swipe = {
    row,
    rc: row.querySelector(':scope > .rc'),
    id: e.pointerId,
    x0: e.clientX,
    y0: e.clientY,
    base: row === openRow ? -ACT_W : 0,
    x: row === openRow ? -ACT_W : 0,
    mode: null,
  };
});

E.list.addEventListener('pointermove', (e) => {
  const s = swipe;
  if (!s || e.pointerId !== s.id) return;
  const dx = e.clientX - s.x0;
  const dy = e.clientY - s.y0;
  if (!s.mode) {
    if (Math.hypot(dx, dy) < 9) return;
    s.mode = Math.abs(dx) > Math.abs(dy) * 1.15 ? 'h' : 'v';
    if (s.mode === 'v') {
      swipe = null;
      return;
    }
    if (openRow && openRow !== s.row) closeSwipe();
    ensureActions(s.row);
    s.row.classList.add('swiping');
    try {
      s.row.setPointerCapture(e.pointerId);
    } catch {
      /* not critical */
    }
  }
  let x = s.base + dx;
  if (x > 0) x *= 0.2;
  if (x < -ACT_W) x = -ACT_W + (x + ACT_W) * 0.3;
  s.x = x;
  s.rc.style.transform = `translate3d(${x}px,0,0)`;
});

function endSwipe(e) {
  const s = swipe;
  if (!s || e.pointerId !== s.id) return;
  swipe = null;
  if (s.mode !== 'h') return;
  lastSwipe = performance.now();
  s.row.classList.remove('swiping');
  if (s.x < -ACT_W * 0.42) {
    s.rc.style.transform = `translate3d(${-ACT_W}px,0,0)`;
    openRow = s.row;
  } else {
    closeSwipe(s.row);
  }
}
E.list.addEventListener('pointerup', endSwipe);
E.list.addEventListener('pointercancel', endSwipe);

document.addEventListener('pointerdown', (e) => {
  if (openRow && !openRow.contains(e.target)) {
    closeSwipe();
    if (E.list.contains(e.target)) swallowUntil = performance.now() + 450;
  }
}, true);

/* --- drag to reorder --- */

let drag = null;

function enterReorder(rootId) {
  ui.reorder = rootId;
  ui.folded.delete(rootId);
  if (ui.q) {
    ui.q = '';
    E.q.value = '';
  }
  render();
  const sec = E.list.querySelector(`.cat[data-c="${CSS.escape(rootId)}"]`);
  if (sec) sec.scrollIntoView({ block: 'start', behavior: 'smooth' });
  toast('Drag ≡ to reorder. Tap DONE when finished.');
}

function exitReorder() {
  ui.reorder = null;
  render();
}

function startDrag(e) {
  const handle = e.target.closest('.drag');
  const row = handle.closest('.row');
  const box = row.parentElement;
  const rows = [...box.children].filter((r) => r.classList.contains('row'));
  if (rows.length < 2) return;
  e.preventDefault();
  try {
    handle.setPointerCapture(e.pointerId);
  } catch {
    /* not critical */
  }
  drag = {
    handle,
    row,
    rows,
    rects: rows.map((r) => r.getBoundingClientRect()),
    from: rows.indexOf(row),
    to: rows.indexOf(row),
    y0: e.clientY,
    y: e.clientY,
    s0: window.scrollY,
    cat: row.dataset.c,
    id: e.pointerId,
    raf: 0,
  };
  row.classList.add('dragging');
  handle.addEventListener('pointermove', onDragMove);
  handle.addEventListener('pointerup', endDrag);
  handle.addEventListener('pointercancel', endDrag);
  drag.raf = requestAnimationFrame(autoScroll);
}

function layoutDrag() {
  const d = drag;
  const dy = d.y - d.y0 + (window.scrollY - d.s0);
  d.row.style.transform = `translate3d(0,${dy}px,0)`;
  const r0 = d.rects[d.from];
  const center = r0.top + r0.height / 2 + dy;
  let to = d.from;
  for (let i = 0; i < d.rows.length; i++) {
    const mid = d.rects[i].top + d.rects[i].height / 2;
    if (i > d.from && center > mid) to = i;
    if (i < d.from && center < mid && to === d.from) to = i;
  }
  d.to = to;
  d.rows.forEach((r, i) => {
    if (r === d.row) return;
    let off = 0;
    if (d.from < i && i <= to) off = -r0.height;
    else if (to <= i && i < d.from) off = r0.height;
    r.style.transform = off ? `translate3d(0,${off}px,0)` : '';
  });
}

function onDragMove(e) {
  if (!drag || e.pointerId !== drag.id) return;
  drag.y = e.clientY;
  layoutDrag();
}

function autoScroll() {
  if (!drag) return;
  const top = E.top.getBoundingClientRect().bottom + 56;
  const bottom = window.innerHeight - 72;
  let v = 0;
  if (drag.y < top) v = -Math.min(16, (top - drag.y) / 3);
  else if (drag.y > bottom) v = Math.min(16, (drag.y - bottom) / 3);
  if (v) {
    window.scrollBy(0, v);
    layoutDrag();
  }
  drag.raf = requestAnimationFrame(autoScroll);
}

function endDrag(e) {
  const d = drag;
  if (!d || e.pointerId !== d.id) return;
  drag = null;
  cancelAnimationFrame(d.raf);
  d.handle.removeEventListener('pointermove', onDragMove);
  d.handle.removeEventListener('pointerup', endDrag);
  d.handle.removeEventListener('pointercancel', endDrag);
  const ids = d.rows.map((r) => r.dataset.p);
  const [moved] = ids.splice(d.from, 1);
  ids.splice(d.to, 0, moved);
  for (const r of d.rows) r.style.transform = '';
  d.row.classList.remove('dragging');
  if (d.to !== d.from) commit((x) => M.reorder(x, d.cat, ids));
}

/* ================= bottom sheet ================= */

const sheet = { cur: null, stack: [], timer: 0 };

function openSheet(builder, push = false) {
  if (push && sheet.cur) sheet.stack.push(sheet.cur.builder);
  else if (!push) sheet.stack = [];
  mountSheet(builder);
  if (!E.sheet.classList.contains('open')) {
    clearTimeout(sheet.timer);
    if (openRow) closeSwipe();
    E.html.classList.add('sheet-open');
    E.scrim.classList.add('open');
    E.sheet.classList.add('open');
    E.sheet.setAttribute('aria-hidden', 'false');
  }
}

function mountSheet(builder) {
  const prev = sheet.cur;
  sheet.cur = null;
  if (prev && prev.onLeave) prev.onLeave();
  const view = builder();
  view.builder = builder;
  sheet.cur = view;
  const back = sheet.stack.length
    ? h('button', { type: 'button', class: 'back', onclick: sheetBack }, '‹ BACK')
    : null;
  E.sbody.replaceChildren(...[back, view.el].filter(Boolean));
  E.sbody.scrollTop = 0;
  E.sheet.setAttribute('aria-label', view.title || 'Details');
}

function sheetBack() {
  const b = sheet.stack.pop();
  if (b) mountSheet(b);
}

function closeSheet() {
  const cur = sheet.cur;
  if (!cur) return;
  sheet.cur = null;
  sheet.stack = [];
  if (cur.onLeave) cur.onLeave();
  if (document.activeElement && E.sheet.contains(document.activeElement)) document.activeElement.blur();
  E.sheet.classList.remove('open', 'dragging');
  E.sheet.style.transform = '';
  E.scrim.classList.remove('open');
  E.html.classList.remove('sheet-open');
  E.sheet.setAttribute('aria-hidden', 'true');
  sheet.timer = setTimeout(() => {
    if (!sheet.cur) E.sbody.replaceChildren();
  }, 480);
}

function refreshSheet() {
  if (sheet.cur && sheet.cur.refresh) sheet.cur.refresh();
}

/** iOS only raises the keyboard for focus() inside the tap that caused it — borrow that tap. */
function focusLater(input) {
  if (!input) return;
  if (IS_IOS) {
    E.kb.focus({ preventScroll: true });
    setTimeout(() => input.focus({ preventScroll: true }), 380);
  } else {
    setTimeout(() => input.focus({ preventScroll: true }), 120);
  }
}

E.scrim.addEventListener('click', closeSheet);
E.scrim.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

let sheetDrag = null;
E.grab.addEventListener('pointerdown', (e) => {
  sheetDrag = { y0: e.clientY, dy: 0, t0: performance.now(), id: e.pointerId };
  try {
    E.grab.setPointerCapture(e.pointerId);
  } catch {
    /* not critical */
  }
  E.sheet.classList.add('dragging');
});
E.grab.addEventListener('pointermove', (e) => {
  if (!sheetDrag || e.pointerId !== sheetDrag.id) return;
  sheetDrag.dy = Math.max(0, e.clientY - sheetDrag.y0);
  E.sheet.style.transform = `translate3d(0,${sheetDrag.dy}px,0)`;
});
function endSheetDrag(e) {
  const d = sheetDrag;
  if (!d || e.pointerId !== d.id) return;
  sheetDrag = null;
  E.sheet.classList.remove('dragging');
  const v = d.dy / Math.max(1, performance.now() - d.t0);
  if (d.dy > 110 || (d.dy > 24 && v > 0.55)) closeSheet();
  else E.sheet.style.transform = '';
}
E.grab.addEventListener('pointerup', endSheetDrag);
E.grab.addEventListener('pointercancel', endSheetDrag);

/* ================= online lookup ================= */

const webOn = () => prefs.web !== false;

/** Live "from the web" suggestions under a title field. `onPick(result)` gets { ref, title, year, type, note }. */
function webFinder(onPick) {
  const box = h('div', { class: 'sugg web', 'aria-live': 'polite' });
  let timer = 0;
  let ctrl = null;
  let lastKey = '';
  const status = (text) => put(box, h('div', { class: 'web-st' }, text));
  function clear() {
    clearTimeout(timer);
    if (ctrl) ctrl.abort();
    ctrl = null;
    lastKey = '';
    box.replaceChildren();
  }
  function run(query, type, now = false) {
    const q = M.parseTitleYear(query).title.trim();
    clearTimeout(timer);
    if (!webOn() || q.length < 3) {
      clear();
      return;
    }
    const key = `${q.toLowerCase()}|${type}`;
    if (key === lastKey && !now) return;
    timer = setTimeout(async () => {
      lastKey = key;
      if (ctrl) ctrl.abort();
      const mine = new AbortController();
      ctrl = mine;
      status('SEARCHING ONLINE…');
      try {
        const { results, source } = await W.searchTitles(q, mine.signal);
        if (ctrl !== mine) return;
        if (source === 'offline') return status('OFFLINE · ONLINE SUGGESTIONS RETURN WITH A CONNECTION');
        if (!results.length) return status('NO ONLINE MATCH · JUST TYPE IT IN');
        const sorted = results.slice().sort((a, b) => (a.type === type ? 0 : 1) - (b.type === type ? 0 : 1));
        put(box,
          h('div', { class: 'web-st' }, source === 'cache' ? 'FROM THE WEB · SAVED ON THIS PHONE' : 'FROM THE WEB · TAP TO FILL IN'),
          sorted.slice(0, 5).map((r) => h('button', { type: 'button', class: 'web-r', onclick: () => onPick(r) },
            h('span', { class: 's-arrow' }, '↗'),
            h('span', { class: 's-t' }, r.title),
            h('span', { class: 's-m' }, `${r.year || '—'} · ${TYPE_LABEL[r.type]}`),
            r.note ? h('span', { class: 's-n' }, r.note) : null)),
        );
      } catch {
        if (ctrl !== mine) return;
        status('ONLINE LOOKUP UNAVAILABLE · JUST TYPE IT IN');
      }
    }, now ? 0 : 450);
  }
  return { el: box, run, clear };
}

async function webDetails(ref) {
  try {
    return await W.fetchDetails(ref);
  } catch {
    return null;
  }
}

/** Look up every title that has no year; only unambiguous matches are applied (one undo). */
async function fillMissingYears() {
  const todo = Object.values(db.items).filter((it) => !it.year).slice(0, 200);
  if (!todo.length) return toast('Every title already has a year');
  if (!W.isOnline()) return toast('You’re offline — try again with a connection');
  closeSheet();
  const found = [];
  let n = 0;
  toast(`Looking up ${todo.length} title${todo.length > 1 ? 's' : ''}…`);
  for (const it of todo) {
    try {
      const { results } = await W.searchTitles(it.title);
      const same = results.filter((r) => r.type === it.type && r.year && M.norm(r.title) === M.norm(it.title));
      if (same.length === 1) found.push({ id: it.id, year: same[0].year, ref: same[0].ref });
    } catch {
      /* skip this one */
    }
    if (++n % 5 === 0 && n < todo.length) toast(`Looking up… ${n} of ${todo.length}`);
  }
  if (!db) return undefined;
  if (!found.length) return toast('No confident matches — those titles keep their blank year');
  commit((d) => {
    for (const f of found) {
      const it = d.items[f.id];
      if (!it || it.year) continue;
      it.year = M.cleanYear(f.year);
      M.setRef(d, f.id, f.ref);
      it.u = Date.now();
    }
  }, `Filled in ${found.length} of ${todo.length} missing year${todo.length > 1 ? 's' : ''}`);
  return undefined;
}

/* ================= add sheet ================= */

function openAdd(catId) {
  openSheet(() => addSheet(catId));
  focusLater(sheet.cur && sheet.cur.focusEl);
}

function addSheet(preCat) {
  const st = {
    mode: 'one',
    type: ui.tab,
    status: prefs.lastStatus === 'watched' ? 'watched' : 'want',
    cats: new Set(preCat && db.cats[preCat] ? [preCat] : []),
    link: null,
    ref: null,
    refTitle: '',
    webTags: [],
  };

  const title = textInput({ cls: 'big', placeholder: 'Title', maxlength: '160', enterkeyhint: 'enter', autocapitalize: 'words', 'aria-label': 'Title' });
  const year = yearInput('');
  const tags = textInput({ placeholder: 'optional', maxlength: '200', autocapitalize: 'words', 'aria-label': 'Tags' });
  const bulk = h('textarea', {
    class: 'in',
    rows: '7',
    spellcheck: 'false',
    autocapitalize: 'words',
    'aria-label': 'Titles, one per line',
    placeholder: 'One title per line —\nIron Man (2008)\nLoki (2021) [tv]\nThe Avengers, 2012',
  });
  const sugg = h('div', { class: 'sugg' });
  const banner = h('div', { class: 'banner', hidden: true });
  const preview = h('div', { class: 'preview' });
  const chips = h('div', { class: 'chips scroll' });
  const tagChips = h('div', { class: 'chips' });
  const addBtn = h('button', { type: 'button', class: 'btn pri', onclick: () => submit(false) }, 'ADD');
  const nextBtn = h('button', { type: 'button', class: 'btn sec', onclick: () => submit(true) }, 'ADD + NEXT');

  const web = webFinder(pickWeb);
  const single = h('div', null,
    field('TITLE', title),
    sugg,
    web.el,
    banner,
    h('div', { class: 'fields-2' }, field('YEAR', year), field('TAGS', tags)),
    tagChips,
  );
  const many = h('div', { hidden: true }, bulk, preview, field('TAGS', tags.cloneNode()));
  const bulkTags = many.querySelector('input');

  const typeSeg = seg([['movie', 'FILM'], ['tv', 'SERIES']], st.type, (v) => {
    st.type = v;
    paintSugg();
    paintPreview();
  }, 'Type');

  async function pickWeb(r) {
    web.clear();
    const existing = M.findExact(db, { title: r.title, year: r.year, type: r.type, ref: r.ref });
    if (existing) {
      linkTo(existing);
      return;
    }
    st.ref = r.ref;
    st.refTitle = r.title;
    st.type = r.type;
    typeSeg.set(r.type);
    title.value = r.title;
    year.value = r.year;
    paintSugg();
    const d = await webDetails(r.ref);
    if (!d || st.ref !== r.ref) return;
    if (!year.value && d.year) year.value = d.year;
    if (!tags.value.trim() && d.genres.length) tags.value = d.genres.slice(0, 2).join(', ');
    st.webTags = [...d.genres, ...d.countries];
    paintTagChips();
  }
  const statusSeg = seg([['want', 'TO WATCH'], ['watched', 'WATCHED']], st.status, (v) => {
    st.status = v;
    prefs.lastStatus = v;
    savePrefs();
  }, 'Status');
  const modeSeg = seg([['one', 'SINGLE'], ['many', 'BULK']], st.mode, (v) => {
    st.mode = v;
    single.hidden = v !== 'one';
    many.hidden = v !== 'many';
    nextBtn.hidden = v !== 'one';
    paintPreview();
    (v === 'one' ? title : bulk).focus({ preventScroll: true });
  }, 'Entry mode');

  function paintSugg() {
    if (st.link) {
      sugg.replaceChildren();
      return;
    }
    const hits = M.findMatches(db, title.value, st.type, 3);
    const idx = hits.length ? M.buildIndex(db) : null;
    sugg.replaceChildren(
      ...hits.map((it) => {
        const where = (idx.byItem.get(it.id) || []).map((p) => db.cats[p.cat].name);
        return h('button', { type: 'button', onclick: () => linkTo(it) },
          h('span', { class: 's-arrow' }, '↳'),
          h('span', { class: 's-t' }, it.title),
          h('span', { class: 's-m' }, `${it.year || '—'} · ${TYPE_LABEL[it.type]}${where.length ? ` · ${where.length} LIST${where.length > 1 ? 'S' : ''}` : ''}`),
        );
      }),
    );
  }

  function linkTo(it) {
    st.link = it.id;
    title.value = it.title;
    year.value = it.year;
    title.disabled = true;
    year.disabled = true;
    banner.hidden = false;
    banner.replaceChildren(
      h('span', null, `Already logged as a ${TYPE_LABEL[it.type].toLowerCase()} — pick lists and tap ADD to file it there too.`),
      h('button', { type: 'button', onclick: unlink }, 'CLEAR'),
    );
    paintSugg();
    paintChips();
  }

  function unlink() {
    st.link = null;
    title.disabled = false;
    year.disabled = false;
    banner.hidden = true;
    title.value = '';
    year.value = '';
    st.ref = null;
    paintChips();
    title.focus({ preventScroll: true });
  }

  function paintChips() {
    const idx = M.buildIndex(db);
    const already = st.link ? new Set((idx.byItem.get(st.link) || []).map((p) => p.cat)) : new Set();
    const out = [];
    walkTree(idx, (c) => {
      const parent = c.parent ? M.pathOf(db, c.parent) : '';
      const on = st.cats.has(c.id);
      out.push(h('button', {
        type: 'button',
        class: `chip${already.has(c.id) ? ' has' : ''}`,
        'aria-pressed': String(on),
        title: already.has(c.id) ? 'Already in this list' : M.pathOf(db, c.id),
        onclick: (e) => {
          if (st.cats.has(c.id)) st.cats.delete(c.id);
          else st.cats.add(c.id);
          e.currentTarget.setAttribute('aria-pressed', String(st.cats.has(c.id)));
        },
      }, c.sys ? h('span', { class: 'star' }, '★') : null, parent ? h('span', { class: 'pp' }, `${parent} / `) : null, c.name, already.has(c.id) ? ' ✓' : null));
    });
    const newChip = h('button', { type: 'button', class: 'chip new', onclick: () => newChip.replaceWith(newInput()) }, '+ NEW LIST');
    chips.replaceChildren(...out, newChip);
  }

  function newInput() {
    const inp = h('input', { class: 'chip-in', type: 'text', placeholder: 'Name, or Parent / Sub', enterkeyhint: 'done', maxlength: '120', autocapitalize: 'words', 'aria-label': 'New list name' });
    let finished = false;
    const done = (create) => {
      if (finished) return;
      finished = true;
      const name = inp.value.trim();
      if (create && name) {
        const c = commit((d) => M.ensurePath(d, name));
        if (c) st.cats.add(c.id);
      }
      paintChips();
    };
    inp.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        done(true);
      } else if (e.key === 'Escape') done(false);
    });
    inp.addEventListener('blur', () => done(true));
    setTimeout(() => inp.focus({ preventScroll: true }), 0);
    return inp;
  }

  function paintTagChips() {
    const have = new Set(M.cleanTags(tags.value).map((t) => t.toLowerCase()));
    const seen = new Set();
    const list = [...st.webTags, ...M.allTags(db)].filter((t) => {
      const k = t.toLowerCase();
      if (have.has(k) || seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 10);
    tagChips.replaceChildren(
      ...list.map((t) => h('button', {
        type: 'button',
        class: 'chip tag',
        onclick: () => {
          tags.value = [...M.cleanTags(tags.value), t].join(', ');
          paintTagChips();
        },
      }, `+ ${t}`)),
    );
  }

  function paintPreview() {
    if (st.mode !== 'many') return;
    const rows = M.parseBulk(bulk.value, st.type);
    if (!rows.length) {
      preview.replaceChildren(h('div', { class: 'p-n' }, 'Add “[tv]” or “film:” to a line to override the type. Order is kept — handy for timelines.'));
      addBtn.textContent = 'ADD';
      return;
    }
    const tv = rows.filter((r) => r.type === 'tv').length;
    addBtn.textContent = `ADD ${rows.length}`;
    preview.replaceChildren(
      h('div', { class: 'p-sum' }, `${rows.length} TITLE${rows.length > 1 ? 'S' : ''} · ${rows.length - tv} FILM · ${tv} SERIES`),
      ...rows.slice(0, 60).map((r, i) => h('div', null, h('span', { class: 'p-n' }, `${String(i + 1).padStart(2, '0')}  `), `${r.title}`, h('span', { class: 'p-n' }, ` · ${r.year || '—'} · ${TYPE_LABEL[r.type]}`))),
    );
  }

  title.addEventListener('input', () => {
    paintSugg();
    if (st.ref && title.value !== st.refTitle) st.ref = null;
    if (!st.link && !st.ref) web.run(title.value, st.type);
    else web.clear();
    const guess = M.parseTitleYear(title.value).year;
    year.placeholder = guess || '—';
  });
  tags.addEventListener('input', paintTagChips);
  bulk.addEventListener('input', paintPreview);
  for (const el of [title, year]) {
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        submit(true);
      }
    });
  }

  function catNames(ids) {
    return ids.map((id) => db.cats[id].name).join(', ');
  }

  function submit(keepOpen) {
    const cats = [...st.cats].filter((id) => db.cats[id]);
    if (st.mode === 'many') {
      const rows = M.parseBulk(bulk.value, st.type);
      if (!rows.length) return nudge(bulk);
      let created = 0;
      let linked = 0;
      const ok = commit((d) => {
        for (const r of rows) {
          let it = M.findExact(d, r);
          if (it) linked++;
          else {
            it = M.addItem(d, { ...r, tags: bulkTags.value, status: st.status });
            created++;
          }
          for (const c of cats) M.addPlace(d, it.id, c);
          if (rows.length <= 12) ui.flash.add(it.id);
        }
        return true;
      }, () => `Added ${created}${linked ? ` · filed ${linked} already logged` : ''}${cats.length ? ` → ${catNames(cats)}` : ' · Unsorted'}`);
      if (ok) {
        closeSheet();
        revealFlash();
      }
      return undefined;
    }

    let t = title.value;
    let y = year.value.trim();
    if (!st.link && !y) ({ title: t, year: y } = M.parseTitleYear(t));
    t = M.cleanTitle(t);
    if (!t) return nudge(title);
    if (y && !M.cleanYear(y)) {
      nudge(year);
      return toast('Year needs four digits, e.g. 1999');
    }
    let item = st.link && db.items[st.link] ? db.items[st.link] : M.findExact(db, { title: t, year: y, type: st.type, ref: st.ref || '' });
    const existed = !!item;
    if (existed && !cats.length && !st.link) {
      toast(`“${item.title}” is already logged — pick a list to file it in`);
      linkTo(item);
      return undefined;
    }
    const done = commit((d) => {
      if (!item) item = M.addItem(d, { type: st.type, title: t, year: y, tags: tags.value, status: st.status, ref: st.ref || '' });
      else if (st.ref && !item.ref) M.setRef(d, item.id, st.ref);
      for (const c of cats) M.addPlace(d, item.id, c);
      ui.flash.add(item.id);
      return true;
    }, () => `${existed ? 'Filed' : 'Added'} “${t}”${cats.length ? ` → ${catNames(cats)}` : ' · Unsorted'}${item.type !== ui.tab ? ` · under ${TAB_LABEL[item.type]}` : ''}`);
    if (!done) return undefined;
    if (keepOpen) {
      if (st.link) unlink();
      title.value = '';
      year.value = '';
      tags.value = '';
      st.ref = null;
      st.webTags = [];
      web.clear();
      paintSugg();
      paintTagChips();
      title.focus({ preventScroll: true });
    } else {
      closeSheet();
      revealFlash();
    }
    return undefined;
  }

  paintChips();
  paintTagChips();
  paintPreview();

  const el = h('div', { class: 'add' },
    h('div', { class: 'sh-kicker' }, h('span', null, 'NEW ENTRY'), modeSeg),
    h('div', { class: 'quick' }, typeSeg, statusSeg),
    single,
    many,
    label('ADD TO LISTS', 'optional · pick any'),
    chips,
    h('div', { class: 'btns dock' }, nextBtn, addBtn),
  );
  return { el, title: 'New entry', focusEl: title, refresh: () => { paintChips(); } };
}

function revealFlash() {
  requestAnimationFrame(() => {
    const row = E.list.querySelector('.row.flash');
    if (!row) return;
    const r = row.getBoundingClientRect();
    const top = E.top.getBoundingClientRect().bottom;
    if (r.top < top || r.bottom > window.innerHeight - 90) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
}

/* ================= item sheet ================= */

function itemSheet(itemId, placeId, ctxCat, focusEdit) {
  let pid = placeId && db.places[placeId] ? placeId : null;
  let scope = 'here';
  let discard = false;
  const place = () => (pid && db.places[pid] ? db.places[pid] : null);
  const v0 = M.view(db.items[itemId], place());

  const head = h('div', { class: 'shead' });
  const quick = h('div', { class: 'quick' });
  const fTitle = textInput({ cls: 'big', value: v0.title, placeholder: 'Title', maxlength: '160', autocapitalize: 'words', enterkeyhint: 'done', 'aria-label': 'Title' });
  const fYear = yearInput(v0.year);
  const fTags = textInput({ value: v0.tags.join(', '), placeholder: 'optional', maxlength: '200', autocapitalize: 'words', enterkeyhint: 'done', 'aria-label': 'Tags' });
  const tagChips = h('div', { class: 'chips' });
  const scopeBox = h('div');
  const overrideNote = h('div');
  const saveBtn = h('button', { type: 'button', class: 'btn pri sm', onclick: () => save(false) }, 'SAVE CHANGES');
  const lists = h('div');
  const pos = h('div');
  const danger = h('div');

  const current = () => ({ title: fTitle.value, year: fYear.value, tags: fTags.value });
  const dirty = () => {
    const it = db.items[itemId];
    if (!it) return false;
    const v = M.view(it, place());
    const c = current();
    return M.cleanTitle(c.title) !== v.title || c.year.trim() !== v.year || M.cleanTags(c.tags).join('\u0001') !== v.tags.join('\u0001');
  };
  const paintSave = () => {
    saveBtn.disabled = !dirty();
  };

  function scoped() {
    const p = place();
    return p && scope === 'here' && M.placesOf(db, itemId).length > 1 ? p : null;
  }

  function save(silent) {
    if (!dirty()) return true;
    const c = current();
    if (!M.cleanTitle(c.title)) {
      nudge(fTitle);
      return false;
    }
    if (c.year.trim() && !M.cleanYear(c.year)) {
      nudge(fYear);
      toast('Year needs four digits, e.g. 1999');
      return false;
    }
    const p = scoped();
    const where = p ? `only in ${db.cats[p.cat].name}` : 'everywhere';
    commit((d) => M.editItem(d, itemId, c, p ? p.id : null), `${silent ? 'Auto-saved' : 'Saved'} ${where}`);
    syncForm();
    return true;
  }

  function syncForm() {
    const it = db.items[itemId];
    if (!it) return;
    const v = M.view(it, place());
    fTitle.value = v.title;
    fYear.value = v.year;
    fTags.value = v.tags.join(', ');
    paintSave();
    paintTagChips();
  }

  for (const el of [fTitle, fYear, fTags]) {
    el.addEventListener('input', () => {
      paintSave();
      if (el === fTags) paintTagChips();
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        el.blur();
        save(false);
      }
    });
  }

  function paintHead() {
    const it = db.items[itemId];
    const p = place();
    const v = M.view(it, p);
    const n = M.placesOf(db, itemId).length;
    head.replaceChildren(
      h('div', { class: 'sh-kicker' }, h('span', null, p ? M.pathOf(db, p.cat).toUpperCase() : n ? 'LOG' : 'UNSORTED')),
      h('h2', { class: 'sh-title' }, v.title),
      h('div', { class: 'sh-meta' },
        [TYPE_LABEL[it.type], v.year || 'NO YEAR', n ? `IN ${n} LIST${n > 1 ? 'S' : ''}` : 'IN NO LIST', p && p.o ? 'CUSTOM IN THIS LIST' : null].filter(Boolean).join(' · '),
        it.ref ? [' · ', h('a', { class: 'reflink', href: W.refUrl(it.ref), target: '_blank', rel: 'noopener noreferrer' }, 'WIKIDATA ↗')] : null,
        v.tags.length ? h('div', null, v.tags.map((t) => h('button', {
          type: 'button',
          class: 'tagbtn',
          title: `Show everything tagged ${t}`,
          onclick: () => {
            closeSheet();
            setQuery(t);
          },
        }, `[${t}]`))) : null,
      ),
    );
  }

  function paintQuick() {
    const it = db.items[itemId];
    const fav = M.isFav(db, itemId);
    quick.replaceChildren(
      seg([['want', 'TO WATCH'], ['watched', 'WATCHED']], it.status, (v) => commit((d) => M.setStatus(d, itemId, v)), 'Status'),
      h('button', {
        type: 'button',
        class: `tog${fav ? ' on' : ''}`,
        'aria-pressed': String(fav),
        onclick: () => {
          const on = commit((d) => M.toggleFav(d, itemId));
          toast(on ? 'Added to Favorites' : 'Removed from Favorites');
        },
      }, h('span', { class: 'g' }, fav ? '★' : '☆'), 'FAVORITE'),
      seg([['movie', 'FILM'], ['tv', 'SERIES']], it.type, (v) => {
        commit((d) => M.setType(d, itemId, v));
        toast(`Now filed under ${TAB_LABEL[v]}`);
      }, 'Type'),
    );
  }

  function paintScope() {
    const p = place();
    const n = M.placesOf(db, itemId).length;
    if (!p || n < 2) {
      scopeBox.replaceChildren();
    } else {
      const name = db.cats[p.cat].name;
      const opt = (v, text, sub) => h('button', {
        type: 'button',
        class: 'check radio',
        role: 'radio',
        'aria-checked': String(scope === v),
        onclick: () => {
          scope = v;
          paintScope();
        },
      }, h('span', { class: 'bx' }), h('span', null, text, h('span', { class: 'sub' }, sub)));
      scopeBox.replaceChildren(
        label('APPLY EDITS TO'),
        h('div', { role: 'radiogroup', 'aria-label': 'Apply edits to' },
          opt('here', `Only “${name}”`, 'Other lists keep their own version'),
          opt('all', `All ${n} lists`, 'Updates this title everywhere it appears'),
        ),
      );
    }
    put(overrideNote,
      p && p.o
        ? h('p', { class: 'note' }, 'This list has its own version of these details. ',
          h('button', {
            type: 'button',
            class: 'tagbtn',
            onclick: () => {
              commit((d) => M.resetOverride(d, p.id), `Reset to shared details in ${db.cats[p.cat].name}`);
              syncForm();
            },
          }, h('b', null, 'RESET TO SHARED')))
        : null,
    );
  }

  function paintTagChips() {
    const have = new Set(M.cleanTags(fTags.value).map((t) => t.toLowerCase()));
    const list = M.allTags(db).filter((t) => !have.has(t.toLowerCase())).slice(0, 8);
    tagChips.replaceChildren(...list.map((t) => h('button', {
      type: 'button',
      class: 'chip tag',
      onclick: () => {
        fTags.value = [...M.cleanTags(fTags.value), t].join(', ');
        paintTagChips();
        paintSave();
      },
    }, `+ ${t}`)));
  }

  function paintLists() {
    const idx = M.buildIndex(db);
    const mine = new Set((idx.byItem.get(itemId) || []).map((p) => p.cat));
    const rows = [];
    walkTree(idx, (c, depth) => {
      const on = mine.has(c.id);
      const n = (idx.byCat.get(c.id) || []).length;
      rows.push(h('button', {
        type: 'button',
        class: `check d${depth}`,
        role: 'checkbox',
        'aria-checked': String(on),
        onclick: () => {
          commit((d) => M.setMember(d, itemId, c.id, !on));
          toast(on ? `Removed from ${c.name}` : `Added to ${c.name}`);
        },
      }, h('span', { class: 'bx' }), h('span', { class: 'nm' }, catLabel(c)), h('span', { class: 'r' }, String(n))));
    });
    lists.replaceChildren(
      label('LISTS', 'tap to add or remove'),
      ...rows,
      newListRow('New list, or Parent / Sub', (name) => {
        commit((d) => {
          const c = M.ensurePath(d, name);
          M.addPlace(d, itemId, c.id);
          return c;
        });
      }),
    );
  }

  function paintPos() {
    const p = place();
    pos.replaceChildren();
    if (!p) return;
    const cat = db.cats[p.cat];
    const eff = M.effective(db, cat);
    if (eff.sort !== 'manual') return;
    const ids = M.sortPlaces(db, visiblePlaces(cat, eff, M.buildIndex(db)), 'manual').map((x) => x.id);
    const i = ids.indexOf(p.id);
    if (ids.length < 2 || i < 0) return;
    const move = (to) => {
      const next = ids.slice();
      next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, to)), 0, p.id);
      commit((d) => M.reorder(d, cat.id, next));
    };
    pos.append(
      label(`ORDER IN ${cat.name}`),
      h('div', { class: 'posrow' },
        h('span', { class: 'p' }, String(i + 1).padStart(2, '0'), h('span', null, ` / ${String(ids.length).padStart(2, '0')}`)),
        h('button', { type: 'button', class: 'mini', disabled: i === 0, onclick: () => move(0), 'aria-label': 'Move to top' }, 'TOP'),
        h('button', { type: 'button', class: 'mini', disabled: i === 0, onclick: () => move(i - 1), 'aria-label': 'Move up' }, '↑'),
        h('button', { type: 'button', class: 'mini', disabled: i === ids.length - 1, onclick: () => move(i + 1), 'aria-label': 'Move down' }, '↓'),
        h('button', { type: 'button', class: 'mini', disabled: i === ids.length - 1, onclick: () => move(ids.length), 'aria-label': 'Move to end' }, 'END'),
      ),
    );
  }

  function paintDanger() {
    const p = place();
    const it = db.items[itemId];
    const n = M.placesOf(db, itemId).length;
    put(danger,
      label('REMOVE'),
      p
        ? act('−', `Remove from ${db.cats[p.cat].name}`, () => {
          discard = true;
          const name = db.cats[p.cat].name;
          closeSheet();
          commit((d) => M.removePlace(d, p.id), `Removed from ${name}${n === 1 ? ' · now in Unsorted' : ''}`);
        }, null, 'act', n > 1 ? `Stays in its other ${n - 1} list${n > 2 ? 's' : ''}` : 'This list only — the log moves to Unsorted')
        : null,
      confirmAct('×', 'Delete log completely', `Tap again — deletes from ${n > 1 ? `all ${n} lists` : 'everywhere'}`, () => {
        discard = true;
        closeSheet();
        commit((d) => M.deleteItem(d, itemId), `Deleted “${it.title}”`);
      }),
    );
  }

  function refresh() {
    if (!db.items[itemId]) {
      closeSheet();
      return;
    }
    if (pid && !db.places[pid]) pid = null;
    paintHead();
    paintQuick();
    paintScope();
    paintLists();
    paintPos();
    paintDanger();
    paintSave();
  }

  const finder = webFinder(async (r) => {
    finder.clear();
    if (!fYear.value && r.year) fYear.value = r.year;
    commit((d) => M.setRef(d, itemId, r.ref));
    const d = await webDetails(r.ref);
    if (d) {
      if (!fYear.value && d.year) fYear.value = d.year;
      const merged = M.cleanTags([...M.cleanTags(fTags.value), ...d.genres.slice(0, 3)]);
      fTags.value = merged.join(', ');
    }
    paintSave();
    paintTagChips();
    toast(dirty() ? 'Filled in from Wikidata — check it, then SAVE' : 'Linked to Wikidata — details already match');
  });
  function findOnline() {
    if (!W.isOnline()) {
      toast('You’re offline — online lookup returns with a connection');
      return;
    }
    finder.run(fTitle.value, db.items[itemId].type, true);
  }

  refresh();
  paintTagChips();

  const editBox = h('div', null,
    label('EDIT DETAILS', webOn() ? h('button', { type: 'button', class: 'lbl-btn', onclick: findOnline }, '↗ FIND ONLINE') : null),
    field('TITLE', fTitle),
    finder.el,
    h('div', { class: 'fields-2' }, field('YEAR', fYear), field('TAGS', fTags)),
    tagChips,
    scopeBox,
    overrideNote,
    h('div', { class: 'btns' }, h('span'), saveBtn),
  );

  const el = h('div', { class: 'isheet' }, head, quick, editBox, lists, pos, danger);
  if (focusEdit) {
    requestAnimationFrame(() => {
      E.sbody.scrollTop = editBox.getBoundingClientRect().top - E.sbody.getBoundingClientRect().top + E.sbody.scrollTop - 8;
    });
    focusLater(fTitle);
  }
  return {
    el,
    title: v0.title,
    refresh,
    onLeave: () => {
      if (!discard && db && db.items[itemId] && dirty()) save(true);
    },
  };
}

/* ================= list (category) sheet ================= */

function catSheet(catId) {
  let deleting = false;
  let purge = false;
  const el = h('div', { class: 'csheet' });
  const nameIn = textInput({ cls: 'big', value: db.cats[catId].name, maxlength: '48', autocapitalize: 'words', enterkeyhint: 'done', 'aria-label': 'List name' });

  const rename = () => {
    const c = db.cats[catId];
    if (!c) return;
    const nm = M.cleanName(nameIn.value);
    if (!nm) {
      nameIn.value = c.name;
      return;
    }
    if (nm !== c.name) {
      M.updateCat(db, catId, { name: nm });
      persist();
      render();
      toast(`Renamed to ${nm}`);
    }
  };
  nameIn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nameIn.blur();
    }
  });
  nameIn.addEventListener('blur', rename);

  const body = h('div');

  function paint() {
    const c = db.cats[catId];
    if (!c) {
      sheet.stack.length ? sheetBack() : closeSheet();
      return;
    }
    const idx = M.buildIndex(db);
    const eff = M.effective(db, c);
    const depth = M.depthOf(db, catId);
    const top = !c.parent;
    const ids = M.subtreeIds(db, catId);
    let films = 0;
    let series = 0;
    const seen = new Set();
    for (const id of ids) {
      for (const p of idx.byCat.get(id) || []) {
        if (seen.has(p.item)) continue;
        seen.add(p.item);
        if (db.items[p.item].type === 'tv') series++;
        else films++;
      }
    }
    const kids = idx.kids.get(catId) || [];
    const parts = [];

    parts.push(
      h('div', { class: 'sh-kicker' }, h('span', null, c.parent ? `SUB-LIST OF ${M.pathOf(db, c.parent).toUpperCase()}` : c.sys ? 'BUILT-IN LIST' : 'LIST')),
      field(null, nameIn),
      h('div', { class: 'sh-meta' }, [
        `${films} FILM${films === 1 ? '' : 'S'}`,
        `${series} SERIES`,
        kids.length ? `${kids.length} SUB-LIST${kids.length > 1 ? 'S' : ''}` : null,
        eff.timeline ? 'TIMELINE' : null,
      ].filter(Boolean).join(' · ')),
    );

    if (top && !c.sys) {
      parts.push(
        label('FORMAT'),
        h('div', { class: 'quick' },
          seg([['list', 'COLLECTION'], ['timeline', 'TIMELINE']], c.kind, (v) => {
            commit((d) => M.updateCat(d, catId, v === 'timeline' ? { kind: v, link: true } : { kind: v }));
            toast(v === 'timeline' ? 'Timeline: numbered, in your order, films + series together' : 'Collection');
          }, 'Format'),
        ),
        h('p', { class: 'note' }, c.kind === 'timeline'
          ? 'Numbered in the order you set — ideal for franchises like the MCU. Use sub-lists for phases.'
          : 'A plain collection. Choose how it sorts below.'),
        h('button', {
          type: 'button',
          class: 'check',
          role: 'checkbox',
          'aria-checked': String(!!c.link),
          onclick: () => commit((d) => M.updateCat(d, catId, { link: !c.link })),
        }, h('span', { class: 'bx' }), h('span', null, 'Cross-link films & series', h('span', { class: 'sub' }, 'Show both in this list under MOVIES and TV SERIES. Each title still counts in its own section.'))),
      );
    } else if (c.parent) {
      parts.push(h('p', { class: 'note' }, `Format and cross-linking follow `, h('b', null, eff.root.name), '.'));
    }

    if (!eff.timeline) {
      parts.push(
        label('SORT'),
        h('div', { class: 'chips' }, M.SORTS.map((s) => h('button', {
          type: 'button',
          class: 'chip',
          'aria-pressed': String(eff.sort === s),
          onclick: () => commit((d) => M.updateCat(d, catId, { sort: s })),
        }, SORT_LABEL[s]))),
      );
    }

    if (!c.sys && depth < M.MAX_DEPTH - 1) {
      parts.push(
        label('SUB-LISTS', eff.timeline ? 'e.g. Phase One, Phase Two' : null),
        ...kids.map((k) => {
          const n = (idx.byCat.get(k.id) || []).length;
          return act('/', k.name, () => openSheet(() => catSheet(k.id), true), `${n} ›`);
        }),
        newListRow('Add a sub-list', (name) => {
          commit((d) => M.addCat(d, { name, parent: catId }));
          toast(`Added sub-list ${M.cleanName(name)}`);
        }),
      );
    }

    const canReorder = eff.sort === 'manual';
    const sibs = Object.values(db.cats).filter((x) => !x.sys && (x.parent || null) === (c.parent || null)).sort((a, b) => a.order - b.order || a.t - b.t);
    const si = sibs.indexOf(c);
    parts.push(
      label('ACTIONS'),
      act('+', `Add titles to ${c.name}`, () => {
        closeSheet();
        openAdd(catId);
      }),
      canReorder
        ? act('≡', 'Reorder titles by dragging', () => {
          closeSheet();
          enterReorder(eff.root.id);
        })
        : act('≡', 'Reorder titles by dragging', null, 'SET SORT TO CUSTOM', 'act'),
    );
    if (!canReorder) parts[parts.length - 1].disabled = true;
    if (!c.sys) {
      parts.push(
        act('↑', 'Move list up', () => commit((d) => M.moveCat(d, catId, -1)), null),
        act('↓', 'Move list down', () => commit((d) => M.moveCat(d, catId, 1)), null),
      );
      parts[parts.length - 2].disabled = si <= 0;
      parts[parts.length - 1].disabled = si >= sibs.length - 1;
    }

    if (!c.sys) {
      const excl = M.exclusiveCount(db, catId);
      parts.push(label('DELETE'));
      if (!deleting) {
        parts.push(act('×', `Delete ${c.name}…`, () => {
          deleting = true;
          paint();
        }, null, 'act danger'));
      } else {
        parts.push(h('div', { class: 'panel' },
          h('p', { class: 'note' }, `Deletes “${c.name}”${kids.length ? ' and its sub-lists' : ''}. Titles stay in your other lists; titles only here move to Unsorted.`),
          excl
            ? h('button', {
              type: 'button',
              class: 'check',
              role: 'checkbox',
              'aria-checked': String(purge),
              onclick: () => {
                purge = !purge;
                paint();
              },
            }, h('span', { class: 'bx' }), h('span', null, `Also delete the ${excl} title${excl > 1 ? 's' : ''} that only live here`))
            : null,
          h('div', { class: 'btns' },
            h('button', { type: 'button', class: 'btn sec sm', onclick: () => { deleting = false; paint(); } }, 'CANCEL'),
            h('button', {
              type: 'button',
              class: 'btn pri sm',
              onclick: () => {
                const name = c.name;
                nameIn.removeEventListener('blur', rename);
                if (sheet.stack.length) sheetBack();
                else closeSheet();
                commit((d) => M.deleteCat(d, catId, { purge }), `Deleted list ${name}`);
              },
            }, 'DELETE LIST'),
          ),
        ));
      }
    }
    body.replaceChildren(...parts);
  }

  paint();
  el.append(body);
  return { el, title: db.cats[catId].name, refresh: paint, onLeave: () => { if (db && db.cats[catId]) rename(); } };
}

/* ================= menu sheet ================= */

function menuSheet() {
  const el = h('div', { class: 'msheet' });
  let pass = null; // which passcode form is open

  function paint() {
    const s = M.stats(db);
    const idx = M.buildIndex(db);
    const listRows = [];
    walkTree(idx, (c, depth) => {
      const n = M.subtreeIds(db, c.id).reduce((a, id) => a + (idx.byCat.get(id) || []).length, 0);
      const eff = M.effective(db, c);
      listRows.push(h('button', {
        type: 'button',
        class: `check d${depth}`,
        onclick: () => openSheet(() => catSheet(c.id), true),
      }, h('span', { class: 'nm' }, depth ? '/ ' : '', catLabel(c)), h('span', { class: 'r' }, `${depth === 0 && eff.timeline ? 'TIMELINE · ' : ''}${n} ›`)));
    });

    let newKind = 'list';
    const kindSeg = seg([['list', 'COLLECTION'], ['timeline', 'TIMELINE']], newKind, (v) => { newKind = v; }, 'New list format');

    const backup = prefs.lastBackup ? new Date(prefs.lastBackup).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'never';

    put(el,
      h('div', { class: 'sh-kicker' }, h('span', null, 'EXODUS. · ARCHIVE')),
      h('div', { class: 'stats' },
        h('div', null, h('b', null, String(s.movie)), 'FILMS'),
        h('div', null, h('b', null, String(s.tv)), 'SERIES'),
        h('div', null, h('b', null, String(s.movieW + s.tvW)), 'WATCHED'),
        h('div', null, h('b', null, String(s.lists)), 'LISTS'),
      ),

      label('LISTS', 'tap to edit'),
      ...listRows,
      h('div', { class: 'quick' }, kindSeg),
      newListRow('New list, or Parent / Sub', (name) => {
        const c = commit((d) => M.ensurePath(d, name, newKind));
        if (c) toast(`Created ${M.pathOf(db, c.id)}`);
      }),

      label('TEMPLATES'),
      act('⇄', 'Load the MCU timeline', () => {
        closeSheet();
        loadTemplate('mcu');
      }, 'FILMS + SERIES'),
      h('p', { class: 'note' }, `${TEMPLATES.mcu.blurb}. Titles you already logged are linked, not duplicated.`),

      label('BACKUP', `last: ${backup}`),
      act('↓', 'Export backup (.json)', exportBackup),
      act('↑', 'Import — merge into this library', () => importBackup('merge')),
      act('↑', 'Import — replace this library', () => importBackup('replace')),

      label('ONLINE LOOKUP'),
      h('button', {
        type: 'button',
        class: 'check',
        role: 'checkbox',
        'aria-checked': String(webOn()),
        onclick: () => {
          prefs.web = !webOn();
          savePrefs();
          paint();
        },
      }, h('span', { class: 'bx' }), h('span', null, 'Suggest titles from the internet', h('span', { class: 'sub' }, 'Year, film/series and genres from Wikidata as you type. Only the title you type is sent — your library never leaves this phone. Offline, the app simply skips it.'))),
      webOn() ? act('↗', 'Fill in missing years online', fillMissingYears, `${Object.values(db.items).filter((it) => !it.year).length} WITHOUT`) : null,
      webOn() ? act('◦', 'Forget saved lookups', () => { W.clearCache(); toast('Saved lookups cleared'); }) : null,

      label('PRIVACY'),
      ...privacyRows(),

      label('STORAGE'),
      h('div', { class: 'act' }, h('span', { class: 'k' }, '●'), h('span', { class: 't' }, 'Saved on this device',
        h('span', { class: 'sub' }, `Every change saves instantly${lastSaved ? ` · last save ${new Date(lastSaved).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}` : ''}${vault.enabled ? ' · encrypted' : ''}`))),
      h('div', { class: 'act' }, h('span', { class: 'k' }, STANDALONE ? '●' : '◦'), h('span', { class: 't' }, STANDALONE ? 'Installed · works offline' : 'Not installed yet',
        h('span', { class: 'sub' }, STANDALONE
          ? (storagePersisted === false ? 'Storage may be cleared if the phone runs very low on space — keep a backup' : 'Your library stays put between launches')
          : 'In Safari: Share → Add to Home Screen. Until then Safari may clear data after weeks without a visit.'))),

      label('ABOUT'),
      h('p', { class: 'note' }, 'Everything stays on this device — no account, no server, no tracking. Export a backup now and then: it is the only copy that survives losing or resetting the phone.'),
      label('DANGER'),
      confirmAct('×', 'Erase this library', 'Tap again — erases every title and list', () => {
        vault.wipe();
        db = M.createDB();
        ui.folded.clear();
        persist();
        savePrefs();
        closeSheet();
        render();
        toast('Library erased');
      }),
    );
  }

  function privacyRows() {
    if (!vault.supported) {
      return [h('p', { class: 'note' }, 'A passcode lock needs a secure (https) connection.')];
    }
    if (!vault.enabled) {
      if (pass !== 'set') return [act('◦', 'Set a passcode', () => { pass = 'set'; paint(); }, 'OFF')];
      return passForm({
        fields: ['New passcode', 'Repeat passcode'],
        cta: 'ENCRYPT & LOCK',
        note: 'Your library is encrypted on this device (AES-256). If you forget the passcode it cannot be recovered — export a backup first.',
        run: async ([a, b]) => {
          if (a.length < 4) throw new Error('Use at least 4 characters');
          if (a !== b) throw new Error('Passcodes don’t match');
          await persist();
          await vault.enable(a, db);
          pass = null;
          toast('Passcode on · library encrypted');
        },
      });
    }
    const rows = [
      h('div', { class: 'act' }, h('span', { class: 'k' }, '●'), h('span', null, 'Passcode lock'), h('span', { class: 'r' }, 'ON · AES-256')),
      h('div', { class: 'quick' },
        seg(AUTOLOCK.map(([m, t]) => [String(m), t]), String(prefs.autoLock ?? 1), (v) => {
          prefs.autoLock = Number(v);
          savePrefs();
        }, 'Auto-lock after'),
      ),
      h('p', { class: 'note' }, 'Locks again after the app has been in the background this long.'),
      act('◦', 'Lock now', () => lockNow()),
    ];
    if (pass === 'change') {
      rows.push(...passForm({
        fields: ['Current passcode', 'New passcode', 'Repeat new passcode'],
        cta: 'CHANGE PASSCODE',
        run: async ([cur, a, b]) => {
          if (!(await vault.verify(cur))) throw new Error('Current passcode is wrong');
          if (a.length < 4) throw new Error('Use at least 4 characters');
          if (a !== b) throw new Error('Passcodes don’t match');
          await persist();
          await vault.enable(a, db);
          pass = null;
          toast('Passcode changed');
        },
      }));
    } else if (pass === 'off') {
      rows.push(...passForm({
        fields: ['Current passcode'],
        cta: 'TURN OFF LOCK',
        note: 'Your library will be stored unencrypted on this device.',
        run: async ([cur]) => {
          if (!(await vault.verify(cur))) throw new Error('Wrong passcode');
          await persist();
          await vault.disable(db);
          pass = null;
          toast('Passcode off');
        },
      }));
    } else {
      rows.push(
        act('◦', 'Change passcode', () => { pass = 'change'; paint(); }),
        act('◦', 'Turn off passcode', () => { pass = 'off'; paint(); }),
      );
    }
    return rows;
  }

  function passForm({ fields, cta, note, run }) {
    const inputs = fields.map((f) => h('input', {
      class: 'in mono',
      type: 'password',
      placeholder: f,
      'aria-label': f,
      autocomplete: f.startsWith('Current') ? 'current-password' : 'new-password',
      enterkeyhint: 'next',
      maxlength: '128',
    }));
    const err = h('p', { class: 'note', role: 'alert' });
    const go = h('button', { type: 'button', class: 'btn pri sm' }, cta);
    let busy = false;
    go.addEventListener('click', async () => {
      if (busy) return;
      busy = true;
      go.disabled = true;
      err.textContent = '';
      try {
        await run(inputs.map((i) => i.value));
        paint();
      } catch (e) {
        err.textContent = e.message || 'Something went wrong';
        go.disabled = false;
      } finally {
        busy = false;
      }
    });
    return [
      h('div', { class: 'panel' },
        ...inputs.map((i) => field(null, i)),
        note ? h('p', { class: 'note' }, note) : null,
        err,
        h('div', { class: 'btns' }, h('button', { type: 'button', class: 'btn sec sm', onclick: () => { pass = null; paint(); } }, 'CANCEL'), go),
      ),
    ];
  }

  paint();
  return { el, title: 'Menu', refresh: paint };
}

/* ================= templates, backup ================= */

function loadTemplate(key) {
  const tpl = TEMPLATES[key];
  if (!tpl) return;
  const res = commit((d) => {
    const r = M.applyTemplate(d, tpl);
    ui.folded.delete(r.root.id);
    return r;
  }, `Loaded ${tpl.name} timeline`);
  if (res) {
    savePrefs();
    requestAnimationFrame(() => {
      const sec = E.list.querySelector(`.cat[data-c="${CSS.escape(res.root.id)}"]`);
      if (sec) sec.scrollIntoView({ block: 'start' });
    });
  }
}

function exportBackup() {
  const json = JSON.stringify({ app: 'exodus', v: 1, exported: new Date().toISOString(), data: db });
  const name = `exodus-backup-${new Date().toISOString().slice(0, 10)}.json`;
  const file = new File([json], name, { type: 'application/json' });
  const done = () => {
    prefs.lastBackup = Date.now();
    savePrefs();
    refreshSheet();
    toast('Backup exported');
  };
  const download = () => {
    const url = URL.createObjectURL(file);
    const a = h('a', { href: url, download: name });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    done();
  };
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare && navigator.canShare({ files: [file] })) {
    navigator.share({ files: [file], title: name }).then(done).catch((err) => {
      if (err && err.name !== 'AbortError') download();
    });
  } else {
    download();
  }
}

function importBackup(mode) {
  E.file.value = '';
  E.file.onchange = async () => {
    const f = E.file.files && E.file.files[0];
    if (!f) return;
    if (f.size > 10e6) {
      toast('That file is too large to be an Exodus backup');
      return;
    }
    let incoming;
    try {
      const parsed = JSON.parse(await f.text());
      const raw = parsed && parsed.app === 'exodus' ? parsed.data : parsed;
      if (!raw || typeof raw !== 'object' || !raw.items || !raw.cats) throw new Error('bad');
      incoming = M.sanitizeDB(raw);
    } catch {
      toast('That file isn’t an Exodus backup');
      return;
    }
    const n = Object.keys(incoming.items).length;
    commit(() => {
      db = mode === 'merge' ? M.mergeDB(db, incoming) : incoming;
    }, mode === 'merge' ? `Merged ${n} titles from backup` : `Restored ${n} titles from backup`);
  };
  E.file.click();
}

/* ================= lock ================= */

function failState() {
  try {
    return JSON.parse(localStorage.getItem(FAILS_KEY)) || { n: 0, until: 0 };
  } catch {
    return { n: 0, until: 0 };
  }
}

function showLock() {
  db = null;
  ui.reorder = null;
  closeSheet();
  hideToast();
  E.list.replaceChildren();
  E.html.classList.add('is-locked');
  E.lock.hidden = false;
  E.lockErr.textContent = '';
  E.lockPass.value = '';
}

async function lockNow() {
  await persist();
  vault.lock();
  showLock();
}

let unlocking = false;
E.lockForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (unlocking) return;
  const pass = E.lockPass.value;
  if (!pass) return;
  const fails = failState();
  const wait = Math.ceil((fails.until - Date.now()) / 1000);
  if (wait > 0) {
    E.lockErr.textContent = `Too many tries — wait ${wait}s`;
    return;
  }
  unlocking = true;
  E.lockGo.disabled = true;
  E.lockGo.textContent = 'UNLOCKING…';
  try {
    const raw = await vault.unlock(pass);
    db = M.sanitizeDB(raw);
    localStorage.removeItem(FAILS_KEY);
    E.lockPass.value = '';
    E.lockPass.blur();
    E.lock.hidden = true;
    E.html.classList.remove('is-locked');
    render();
    backupNudge();
  } catch {
    const n = fails.n + 1;
    const until = n >= 5 ? Date.now() + Math.min(300, 2 ** (n - 4)) * 1000 : 0;
    localStorage.setItem(FAILS_KEY, JSON.stringify({ n, until }));
    E.lockErr.textContent = n >= 5 ? `Incorrect passcode · wait ${Math.ceil((until - Date.now()) / 1000)}s` : 'Incorrect passcode';
    E.lockForm.classList.remove('shake');
    void E.lockForm.offsetWidth;
    E.lockForm.classList.add('shake');
    E.lockPass.select();
  } finally {
    unlocking = false;
    E.lockGo.disabled = false;
    E.lockGo.textContent = 'UNLOCK';
  }
});

let resetArmed = 0;
E.lockReset.addEventListener('click', () => {
  if (resetArmed && Date.now() - resetArmed < 4000) {
    vault.wipe();
    localStorage.removeItem(FAILS_KEY);
    db = M.createDB();
    persist();
    E.lock.hidden = true;
    E.html.classList.remove('is-locked');
    render();
    toast('Library erased · fresh start');
    return;
  }
  resetArmed = Date.now();
  E.lockReset.textContent = 'Tap again to erase everything on this device';
  E.lockReset.classList.add('armed');
  setTimeout(() => {
    resetArmed = 0;
    E.lockReset.textContent = 'Forgot passcode? Erase this library';
    E.lockReset.classList.remove('armed');
  }, 4000);
});

let hiddenAt = 0;
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    hiddenAt = Date.now();
    persist();
    if (vault.unlocked) E.html.classList.add('curtain-on');
    return;
  }
  const mins = Number(prefs.autoLock ?? 1);
  if (vault.unlocked && db && Date.now() - hiddenAt >= mins * 60000) lockNow();
  E.html.classList.remove('curtain-on');
});
window.addEventListener('pagehide', () => persist());

/* ================= chrome wiring ================= */

function setTab(t) {
  if (t === ui.tab) return;
  ui.tab = t;
  ui.reorder = null;
  savePrefs();
  render();
  window.scrollTo(0, 0);
}

function setQuery(q) {
  ui.q = q;
  E.q.value = q;
  render();
  window.scrollTo(0, 0);
}

E.tabs.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) setTab(b.dataset.tab);
});

E.filters.addEventListener('click', (e) => {
  const b = e.target.closest('[data-st]');
  if (b) {
    ui.status = b.dataset.st;
    savePrefs();
    render();
    return;
  }
  if (e.target.closest('#foldAll')) {
    const roots = foldRoots();
    const allFolded = roots.every((id) => ui.folded.has(id));
    for (const id of roots) {
      if (allFolded) ui.folded.delete(id);
      else ui.folded.add(id);
    }
    savePrefs();
    render();
  }
});

E.q.addEventListener('input', () => {
  ui.q = E.q.value;
  renderSoon();
});
E.q.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') E.q.blur();
  if (e.key === 'Escape') setQuery('');
});
E.qx.addEventListener('click', () => {
  setQuery('');
  E.q.focus();
});

E.menu.addEventListener('click', () => db && openSheet(menuSheet));
E.fab.addEventListener('click', () => db && openAdd(null));

document.addEventListener('keydown', (e) => {
  const typing = /^(INPUT|TEXTAREA)$/.test(document.activeElement && document.activeElement.tagName);
  if (e.key === 'Escape') {
    if (sheet.cur) closeSheet();
    else if (ui.reorder) exitReorder();
    return;
  }
  if (typing || sheet.cur || !db || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === '/') {
    e.preventDefault();
    E.q.focus();
  } else if (e.key === 'n') {
    e.preventDefault();
    openAdd(null);
  }
});

// Sticky list headers sit right under the header; the sheet rides above the iOS keyboard.
new ResizeObserver(() => E.html.style.setProperty('--hdr-h', `${E.top.offsetHeight}px`)).observe(E.top);
if (window.visualViewport) {
  const vv = window.visualViewport;
  const fit = () => {
    E.html.style.setProperty('--vvh', `${vv.height}px`);
    E.html.style.setProperty('--kb', `${Math.max(0, window.innerHeight - vv.height - vv.offsetTop)}px`);
  };
  vv.addEventListener('resize', fit);
  vv.addEventListener('scroll', fit);
  fit();
}

/* ================= boot ================= */

function registerSW() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  navigator.serviceWorker.register('sw.js').then((reg) => reg.update()).catch(() => {});
}

const STANDALONE = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;

/** Safari only: explain Add to Home Screen, which is what makes the app offline and its storage lasting. */
function installBanner() {
  if (STANDALONE || !IS_IOS || prefs.hideInstall) return;
  const bar = h('div', { class: 'install', role: 'note' },
    h('span', { class: 'i-t' }, h('b', null, 'Install exodus.'), ' Tap Share ', h('span', { class: 'i-g', 'aria-label': 'the Share button' }, '↑'), ' then “Add to Home Screen”. It then works offline and your library is kept safe.'),
    h('button', {
      type: 'button',
      'aria-label': 'Dismiss',
      onclick: () => {
        prefs.hideInstall = true;
        savePrefs();
        bar.remove();
      },
    }, '×'),
  );
  E.top.after(bar);
}

/** Once a week at most: nudge toward a backup when there is something worth backing up. */
function backupNudge() {
  if (!db) return;
  const n = Object.keys(db.items).length;
  const week = 7 * 864e5;
  const stale = !prefs.lastBackup || Date.now() - prefs.lastBackup > 30 * 864e5;
  if (n < 10 || !stale || (prefs.lastNudge && Date.now() - prefs.lastNudge < week)) return;
  const tryShow = (tries) => {
    if (!db) return;
    if (E.toast.classList.contains('show') || sheet.cur) {
      if (tries > 0) setTimeout(() => tryShow(tries - 1), 8000);
      return;
    }
    prefs.lastNudge = Date.now();
    savePrefs();
    toast(prefs.lastBackup ? 'It’s been a month since your last backup' : `${n} titles logged — keep a backup copy`, { label: 'EXPORT', run: exportBackup });
  };
  setTimeout(() => tryShow(5), 1500);
}

function boot() {
  if (vault.enabled) {
    if (!vault.supported) {
      E.lock.hidden = false;
      E.lockErr.textContent = 'This library is encrypted. Open exodus. over https to unlock it.';
      E.lockGo.disabled = true;
    } else {
      showLock();
    }
  } else {
    try {
      const raw = vault.readPlain();
      db = raw ? M.sanitizeDB(raw) : M.createDB();
    } catch {
      try {
        localStorage.setItem(`exodus:damaged:${Date.now()}`, localStorage.getItem('exodus:v1') || '');
      } catch {
        /* keep going */
      }
      db = M.createDB();
      setTimeout(() => toast('Your saved library could not be read — a copy was kept aside'), 300);
    }
    render();
  }
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then((ok) => { storagePersisted = ok; }).catch(() => {});
  }
  registerSW();
  installBanner();
  backupNudge();
}

boot();
