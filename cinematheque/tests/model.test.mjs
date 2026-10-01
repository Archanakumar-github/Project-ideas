// Run: node --test cinematheque/tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../js/model.js';
import { TEMPLATES } from '../js/starter.js';

function lib() {
  const db = M.createDB();
  const scifi = M.addCat(db, { name: 'Sci-Fi' });
  const japan = M.addCat(db, { name: 'Japan' });
  const dune = M.addItem(db, { title: 'Dune', year: '2021', tags: 'Epic, Desert', status: 'watched' });
  const pScifi = M.addPlace(db, dune.id, scifi.id);
  const pJapan = M.addPlace(db, dune.id, japan.id);
  return { db, scifi, japan, dune, pScifi, pJapan };
}

test('one title lives in many lists', () => {
  const { db, dune } = lib();
  M.toggleFav(db, dune.id);
  assert.equal(M.placesOf(db, dune.id).length, 3);
  assert.ok(M.isFav(db, dune.id));
  assert.equal(Object.keys(db.items).length, 1);
});

test('adding to a list twice is a no-op', () => {
  const { db, dune, scifi, pScifi } = lib();
  assert.equal(M.addPlace(db, dune.id, scifi.id).id, pScifi.id);
  assert.equal(M.placesOf(db, dune.id).length, 2);
});

test('editing inside one list leaves the other lists untouched', () => {
  const { db, dune, pScifi, pJapan } = lib();
  M.editItem(db, dune.id, { title: 'Dune: Part One', year: '2021', tags: 'Epic' }, pScifi.id);
  assert.equal(M.view(dune, db.places[pScifi.id]).title, 'Dune: Part One');
  assert.deepEqual(M.view(dune, db.places[pScifi.id]).tags, ['Epic']);
  assert.equal(M.view(dune, db.places[pJapan.id]).title, 'Dune');
  assert.equal(db.items[dune.id].title, 'Dune');
});

test('editing everywhere updates the log and clears list overrides', () => {
  const { db, dune, pScifi, pJapan } = lib();
  M.editItem(db, dune.id, { title: 'Local', year: '2021', tags: '' }, pScifi.id);
  M.editItem(db, dune.id, { title: 'Dune (Villeneuve)', year: '2021', tags: 'Epic' });
  assert.equal(db.places[pScifi.id].o, undefined);
  assert.equal(M.view(dune, db.places[pScifi.id]).title, 'Dune (Villeneuve)');
  assert.equal(M.view(dune, db.places[pJapan.id]).title, 'Dune (Villeneuve)');
});

test('an override equal to the shared details is dropped', () => {
  const { db, dune, pScifi } = lib();
  M.editItem(db, dune.id, { title: 'X', year: '2021', tags: ['Epic', 'Desert'] }, pScifi.id);
  M.editItem(db, dune.id, { title: 'Dune', year: '2021', tags: ['Epic', 'Desert'] }, pScifi.id);
  assert.equal(db.places[pScifi.id].o, undefined);
});

test('removing from one list keeps the log and its other lists', () => {
  const { db, dune, pScifi, pJapan } = lib();
  M.removePlace(db, pScifi.id);
  assert.ok(db.items[dune.id]);
  assert.ok(db.places[pJapan.id]);
  assert.equal(db.places[pScifi.id], undefined);
});

test('deleting a log removes it from every list', () => {
  const { db, dune } = lib();
  M.deleteItem(db, dune.id);
  assert.equal(db.items[dune.id], undefined);
  assert.equal(Object.keys(db.places).length, 0);
});

test('sub-lists nest three levels and no deeper', () => {
  const db = M.createDB();
  const a = M.addCat(db, { name: 'Marvel' });
  const b = M.addCat(db, { name: 'MCU', parent: a.id });
  const c = M.addCat(db, { name: 'Phase One', parent: b.id });
  assert.equal(M.depthOf(db, c.id), 2);
  assert.equal(M.pathOf(db, c.id), 'Marvel / MCU / Phase One');
  assert.throws(() => M.addCat(db, { name: 'Too deep', parent: c.id }));
  assert.throws(() => M.addCat(db, { name: 'Nope', parent: M.FAV }));
});

test('ensurePath finds or creates each level', () => {
  const db = M.createDB();
  const c1 = M.ensurePath(db, 'MCU / Phase One', 'timeline');
  const c2 = M.ensurePath(db, 'mcu / phase one');
  assert.equal(c1.id, c2.id);
  assert.equal(M.rootOf(db, c1.id).kind, 'timeline');
  assert.equal(Object.values(db.cats).filter((c) => !c.sys).length, 2);
});

test('timeline settings are inherited by sub-lists', () => {
  const db = M.createDB();
  const root = M.addCat(db, { name: 'MCU', kind: 'timeline' });
  const sub = M.addCat(db, { name: 'Phase One', parent: root.id });
  db.cats[sub.id].sort = 'title';
  const eff = M.effective(db, db.cats[sub.id]);
  assert.equal(eff.timeline, true);
  assert.equal(eff.link, true);
  assert.equal(eff.sort, 'manual');
});

test('deleting a list keeps titles that live elsewhere; purge removes the rest', () => {
  const { db, scifi, japan, dune } = lib();
  const solo = M.addItem(db, { title: 'Solaris', year: '1972' });
  M.addPlace(db, solo.id, scifi.id);
  assert.equal(M.exclusiveCount(db, scifi.id), 1);
  const purged = M.deleteCat(db, scifi.id, { purge: true });
  assert.equal(purged, 1);
  assert.ok(db.items[dune.id]);
  assert.equal(db.items[solo.id], undefined);
  assert.equal(db.cats[scifi.id], undefined);
  assert.ok(M.findPlace(db, dune.id, japan.id));
});

test('deleting a parent deletes its sub-lists; Favorites cannot be deleted', () => {
  const db = M.createDB();
  const root = M.addCat(db, { name: 'MCU' });
  const sub = M.addCat(db, { name: 'Phase One', parent: root.id });
  const it = M.addItem(db, { title: 'Iron Man', year: 2008 });
  M.addPlace(db, it.id, sub.id);
  M.deleteCat(db, root.id);
  assert.equal(db.cats[sub.id], undefined);
  assert.ok(db.items[it.id]);
  assert.equal(M.deleteCat(db, M.FAV), 0);
  assert.ok(db.cats[M.FAV]);
});

test('reorder handles a visible subset and leaves hidden slots alone', () => {
  const db = M.createDB();
  const c = M.addCat(db, { name: 'MCU', kind: 'timeline' });
  const mk = (title, type) => M.addPlace(db, M.addItem(db, { title, type }).id, c.id);
  const a = mk('A', 'movie');
  const tv = mk('TV', 'tv');
  const b = mk('B', 'movie');
  const d = mk('D', 'movie');
  M.reorder(db, c.id, [d.id, a.id, b.id]);
  const order = M.sortPlaces(db, Object.values(db.places), 'manual').map((p) => db.items[p.item].title);
  assert.deepEqual(order, ['D', 'TV', 'A', 'B']);
});

test('sorting: titles ignore leading articles, years put blanks last', () => {
  const db = M.createDB();
  const c = M.addCat(db, { name: 'L' });
  for (const [t, y] of [['The Thing', '1982'], ['Alien', '1979'], ['Brazil', ''], ['An Autumn Afternoon', '1962']]) M.addPlace(db, M.addItem(db, { title: t, year: y }).id, c.id);
  const ps = Object.values(db.places);
  const titles = (sort) => M.sortPlaces(db, ps, sort).map((p) => db.items[p.item].title);
  assert.deepEqual(titles('title'), ['Alien', 'An Autumn Afternoon', 'Brazil', 'The Thing']);
  assert.deepEqual(titles('year'), ['An Autumn Afternoon', 'Alien', 'The Thing', 'Brazil']);
  assert.deepEqual(titles('year-desc'), ['The Thing', 'Alien', 'An Autumn Afternoon', 'Brazil']);
});

test('switching to custom order freezes the current visual order', () => {
  const db = M.createDB();
  const c = M.addCat(db, { name: 'L' });
  for (const t of ['Zodiac', 'Alien', 'Memento']) M.addPlace(db, M.addItem(db, { title: t }).id, c.id);
  M.updateCat(db, c.id, { sort: 'title' });
  M.updateCat(db, c.id, { sort: 'manual' });
  const order = M.sortPlaces(db, Object.values(db.places), 'manual').map((p) => db.items[p.item].title);
  assert.deepEqual(order, ['Alien', 'Memento', 'Zodiac']);
});

test('parseTitleYear', () => {
  assert.deepEqual(M.parseTitleYear('Dune (2021)'), { title: 'Dune', year: '2021' });
  assert.deepEqual(M.parseTitleYear('The Thing [1982]'), { title: 'The Thing', year: '1982' });
  assert.deepEqual(M.parseTitleYear('The Avengers, 2012'), { title: 'The Avengers', year: '2012' });
  assert.deepEqual(M.parseTitleYear('Blade Runner 2049'), { title: 'Blade Runner 2049', year: '' });
  assert.deepEqual(M.parseTitleYear('1917'), { title: '1917', year: '' });
  assert.deepEqual(M.parseTitleYear('2001: A Space Odyssey (1968)'), { title: '2001: A Space Odyssey', year: '1968' });
});

test('parseBulk understands markers, types and spreadsheets', () => {
  const rows = M.parseBulk('1. Iron Man (2008)\n- Loki (2021) [tv]\ntv: Hawkeye, 2021\n\nWandaVision\t2021\tseries\nfilm: Eternals [2021]', 'movie');
  assert.deepEqual(rows, [
    { title: 'Iron Man', year: '2008', type: 'movie' },
    { title: 'Loki', year: '2021', type: 'tv' },
    { title: 'Hawkeye', year: '2021', type: 'tv' },
    { title: 'WandaVision', year: '2021', type: 'tv' },
    { title: 'Eternals', year: '2021', type: 'movie' },
  ]);
});

test('cleaning: years, tags, control characters', () => {
  assert.equal(M.cleanYear('12'), '');
  assert.equal(M.cleanYear('3000'), '');
  assert.equal(M.cleanYear(' 1999 '), '1999');
  assert.deepEqual(M.cleanTags('#Sci-Fi, [Japan], sci-fi, , Noir'), ['Sci-Fi', 'Japan', 'Noir']);
  assert.equal(M.cleanTitle('A\u0000B\nC   D'), 'A B C D');
  assert.equal(M.norm('Amélie & Spider-Man'), 'amelie and spider man');
});

test('findExact and findMatches', () => {
  const { db, dune } = lib();
  assert.equal(M.findExact(db, { title: 'dune', year: '2021', type: 'movie' }).id, dune.id);
  assert.equal(M.findExact(db, { title: 'Dune', year: '1984', type: 'movie' }), null);
  assert.equal(M.findExact(db, { title: 'Dune', type: 'tv' }), null);
  assert.equal(M.findMatches(db, 'un', 'movie')[0].id, dune.id);
});

test('MCU template builds a cross-linked timeline with phases and links existing logs', () => {
  const db = M.createDB();
  const loki = M.addItem(db, { title: 'Loki', year: '2021', type: 'tv', status: 'watched' });
  const { root } = M.applyTemplate(db, TEMPLATES.mcu);
  assert.equal(root.kind, 'timeline');
  assert.equal(root.link, true);
  const phases = Object.values(db.cats).filter((c) => c.parent === root.id);
  assert.equal(phases.length, 6);
  const lokis = Object.values(db.items).filter((i) => i.title === 'Loki');
  assert.equal(lokis.length, 1);
  assert.equal(lokis[0].id, loki.id);
  const types = new Set(Object.values(db.items).map((i) => i.type));
  assert.deepEqual([...types].sort(), ['movie', 'tv']);
  const again = M.applyTemplate(db, TEMPLATES.mcu);
  assert.equal(again.root.name, 'MCU 2');
});

test('sanitizeDB drops junk, prototype keys, broken links and cycles', () => {
  const raw = JSON.parse(`{
    "items": {
      "a1": { "title": "  Heat ", "year": "1995", "type": "movie", "status": "watched", "tags": ["Crime"], "evil": "<img src=x onerror=alert(1)>" },
      "__proto__": { "title": "pwn" },
      "b2": { "title": "" },
      "c3": "nope"
    },
    "cats": {
      "x1": { "name": "Loop A", "parent": "x2" },
      "x2": { "name": "Loop B", "parent": "x1" },
      "x3": { "name": "Orphan", "parent": "missing" },
      "fav": { "name": "Loved" }
    },
    "places": {
      "p1": { "item": "a1", "cat": "x1", "pos": 0, "o": { "title": "Heat (1995)", "year": "1995", "tags": [] } },
      "p2": { "item": "a1", "cat": "x1", "pos": 1 },
      "p3": { "item": "__proto__", "cat": "x1" },
      "p4": { "item": "zz", "cat": "x1" }
    }
  }`);
  const db = M.sanitizeDB(raw);
  assert.deepEqual(Object.keys(db.items), ['a1']);
  assert.equal(db.items.a1.title, 'Heat');
  assert.equal(db.items.a1.evil, undefined);
  assert.equal(Object.getPrototypeOf(db.items), Object.prototype);
  assert.equal({}.title, undefined);
  assert.equal(db.cats.fav.name, 'Loved');
  assert.equal(db.cats.x3.parent, null);
  assert.ok(db.cats.x1.parent === null || db.cats.x2.parent === null);
  assert.deepEqual(Object.keys(db.places), ['p1']);
  assert.equal(db.places.p1.o.title, 'Heat (1995)');
  assert.throws(() => M.sanitizeDB(null));
  assert.throws(() => M.sanitizeDB([1, 2]));
});

test('mergeDB unions libraries and keeps the newer edit', () => {
  const { db, dune, scifi } = lib();
  const other = JSON.parse(JSON.stringify(db));
  other.items[dune.id].title = 'Dune: Part One';
  other.items[dune.id].u = db.items[dune.id].u + 1000;
  const extra = M.addItem(other, { title: 'Arrival', year: '2016' });
  M.addPlace(other, extra.id, scifi.id);
  const merged = M.mergeDB(db, M.sanitizeDB(other));
  assert.equal(merged.items[dune.id].title, 'Dune: Part One');
  assert.ok(merged.items[extra.id]);
  assert.ok(M.findPlace(merged, extra.id, scifi.id));
  assert.equal(M.placesOf(merged, dune.id).length, 2);
});

test('online reference ids are kept, validated and used to spot duplicates', () => {
  const db = M.createDB();
  const it = M.addItem(db, { title: 'Dune', year: '2021', ref: 'Q55340592' });
  assert.equal(it.ref, 'Q55340592');
  assert.equal(M.addItem(db, { title: 'X', ref: 'Q1 OR 1=1' }).ref, undefined);
  assert.equal(M.findExact(db, { title: 'Dune: Part One', type: 'movie', ref: 'Q55340592' }).id, it.id);
  const clean = M.sanitizeDB({ items: { a1: { title: 'A', ref: 'Q42' }, b2: { title: 'B', ref: '}; DROP' } }, cats: {}, places: {} });
  assert.equal(clean.items.a1.ref, 'Q42');
  assert.equal(clean.items.b2.ref, undefined);
});
