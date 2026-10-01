import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, cleanGenre, cleanGenres, parseSearch, parseDetails } from '../js/lookup.js';

test('classify Wikidata descriptions', () => {
  assert.deepEqual(classify('2021 film by Denis Villeneuve'), { type: 'movie', year: '2021' });
  assert.deepEqual(classify('American science fiction television series'), { type: 'tv', year: '' });
  assert.deepEqual(classify('2021 American television miniseries'), { type: 'tv', year: '2021' });
  assert.deepEqual(classify('1984 American documentary'), { type: 'movie', year: '1984' });
  assert.equal(classify('1965 novel by Frank Herbert'), null);
  assert.equal(classify('American film director (born 1967)'), null);
  assert.equal(classify('fictional character in Dune'), null);
  assert.equal(classify('media franchise'), null);
  assert.equal(classify('film series'), null);
  assert.equal(classify(''), null);
});

test('genre labels become short tags', () => {
  assert.equal(cleanGenre('science fiction film'), 'Sci-Fi');
  assert.equal(cleanGenre('drama film'), 'Drama');
  assert.equal(cleanGenre('drama television series'), 'Drama');
  assert.equal(cleanGenre('comedy-drama'), 'Comedy-Drama');
  assert.equal(cleanGenre('film based on literature'), '');
  assert.equal(cleanGenre('LGBT-related film'), '');
  assert.deepEqual(cleanGenres(['adventure film', 'science fiction film', 'drama film', 'action film', 'epic film']), ['Adventure', 'Sci-Fi', 'Drama', 'Action']);
});

test('parse search and details responses', () => {
  const s = parseSearch({ search: [
    { id: 'Q55340592', label: 'Dune', description: '2021 film by Denis Villeneuve' },
    { id: 'Q190192', label: 'Dune', description: '1965 novel by Frank Herbert' },
    { id: 'Q2', label: 'Dune', description: '2000 American television miniseries' },
    { id: 'bad', label: 'X', description: '2000 film' },
  ] });
  assert.deepEqual(s.map((r) => [r.ref, r.type, r.year]), [['Q55340592', 'movie', '2021'], ['Q2', 'tv', '2000']]);
  const d = parseDetails({ results: { bindings: [{ date: { value: '2021-09-03T00:00:00Z' }, genres: { value: 'science fiction film|adventure film' }, countries: { value: 'United States|Canada' } }] } });
  assert.deepEqual(d, { year: '2021', genres: ['Sci-Fi', 'Adventure'], countries: ['United States', 'Canada'] });
  assert.deepEqual(parseDetails({}), { year: '', genres: [], countries: [] });
});
