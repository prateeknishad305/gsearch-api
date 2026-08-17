'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TtlCache } = require('../src/cache');

test('cache stores and returns values before expiry', () => {
  const c = new TtlCache(1000);
  c.set('k', { a: 1 });
  assert.deepEqual(c.get('k'), { a: 1 });
  assert.equal(c.has('k'), true);
});

test('cache expires entries after ttl', async () => {
  const c = new TtlCache(50);
  c.set('k', 42);
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(c.get('k'), null);
  assert.equal(c.has('k'), false);
});

test('cache evicts oldest entry at max size', () => {
  const c = new TtlCache(1000, 3);
  c.set('a', 1);
  c.set('b', 2);
  c.set('c', 3);
  c.set('d', 4);
  assert.equal(c.get('a'), null);
  assert.equal(c.get('b'), 2);
  assert.equal(c.get('d'), 4);
  assert.equal(c.size(), 3);
});
