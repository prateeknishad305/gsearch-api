'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { MultiEngineSearch } = require('../src/search');
const { names } = require('../src/engines');

test('registry exposes all 8 engines', () => {
  assert.deepEqual(
    names().sort(),
    ['bing', 'brave', 'duckduckgo', 'google', 'mojeek', 'qwant', 'startpage', 'yahoo'].sort()
  );
});

test('unknown engine raises UNKNOWN_ENGINE', async () => {
  const engine = new MultiEngineSearch();
  await assert.rejects(() => engine.search('nope', 'test'), (err) => err.code === 'UNKNOWN_ENGINE');
});

test('live: at least one engine returns results (network)', { timeout: 60000 }, async () => {
  const engine = new MultiEngineSearch({ maxQps: 3, cacheTtlMs: 10000 });
  const data = await engine.searchAll('openai', { num: 3 }, ['duckduckgo', 'bing', 'yahoo']);
  assert.ok(data.successful.length >= 1, `no engine succeeded: ${JSON.stringify(data.failed)}`);
  assert.ok(data.results.length >= 1);
  for (const r of data.results) {
    assert.ok(r.title);
    assert.match(r.url, /^https?:\/\//);
    assert.ok(r.engine);
  }
});
