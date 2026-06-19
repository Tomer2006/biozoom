import assert from 'node:assert/strict';
import test from 'node:test';
import { TaxonomySearchIndex, normalizeSearchQuery, scoreSearchName } from './search-index.js';

function createIndex() {
  const index = new TaxonomySearchIndex({ maxCacheEntries: 2 });
  index.add(1, 'Homo Sapiens');
  index.add(2, 'Homo Sapiens Sapiens');
  index.add(3, 'Panthera Leo');
  index.add(4, 'Sapiens Example');
  index.add(5, 'Metasequoia');
  index.finalize();
  return index;
}

test('normalizes whitespace, case, and query length', () => {
  assert.equal(normalizeSearchQuery('  HOMO   Sapiens  '), 'homo sapiens');
  assert.equal(normalizeSearchQuery('x'.repeat(120)).length, 100);
});

test('ranks exact, name-prefix, word-prefix, and substring matches', () => {
  assert.ok(scoreSearchName('homo sapiens', 'homo sapiens') > scoreSearchName('homo sapiens sapiens', 'homo sapiens'));
  assert.ok(scoreSearchName('homo sapiens', 'homo') > scoreSearchName('sapiens homo', 'homo'));
  assert.ok(scoreSearchName('homo sapiens', 'sapiens') > scoreSearchName('metasapiens', 'sapiens'));
  assert.ok(scoreSearchName('metasequoia', 'sequoia') > 0);
});

test('returns deterministic, limited indexed results', () => {
  const matches = createIndex().search('homo', 2);
  assert.deepEqual(matches.map(match => match.id), [1, 2]);
});

test('finds arbitrary substrings without typo matching', () => {
  const index = createIndex();
  assert.deepEqual(index.search('sequoia').map(match => match.id), [5]);
  assert.deepEqual(index.search('hmo').map(match => match.id), []);
});

test('rejects one-character queries and caps results at twenty', () => {
  const index = new TaxonomySearchIndex();
  for (let id = 1; id <= 30; id++) index.add(id, `Test ${id}`);
  index.finalize();
  assert.deepEqual(index.search('t'), []);
  assert.equal(index.search('test', 100).length, 20);
});
