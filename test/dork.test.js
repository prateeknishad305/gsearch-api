'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDork } = require('../src/dork');

test('parses operators, phrases, exclusions and terms', () => {
  const d = parseDork('site:example.com intitle:"admin login" -blog filetype:pdf openai');
  assert.equal(d.original, 'site:example.com intitle:"admin login" -blog filetype:pdf openai');
  assert.deepEqual(d.operators, [
    { name: 'site', value: 'example.com', unsupported: false },
    { name: 'intitle', value: 'admin login', unsupported: false },
    { name: 'filetype', value: 'pdf', unsupported: false },
  ]);
  assert.deepEqual(d.exactPhrases, []);
  assert.deepEqual(d.exclusions, ['blog']);
  assert.deepEqual(d.terms, ['openai']);
  assert.equal(d.valid, true);
});

test('parses quoted operator values', () => {
  const d = parseDork('inurl:"login.php"');
  assert.deepEqual(d.operators, [{ name: 'inurl', value: 'login.php', unsupported: false }]);
  assert.deepEqual(d.exactPhrases, []);
});

test('parses standalone exact phrases', () => {
  const d = parseDork('"exact phrase" index of');
  assert.deepEqual(d.exactPhrases, ['exact phrase']);
  assert.deepEqual(d.terms, ['index', 'of']);
  assert.deepEqual(d.operators, []);
});

test('marks unknown operators as unsupported', () => {
  const d = parseDork('foo:bar hello');
  assert.deepEqual(d.operators, [{ name: 'foo', value: 'bar', unsupported: true }]);
  assert.deepEqual(d.terms, ['hello']);
});

test('empty and whitespace-only queries are invalid', () => {
  assert.equal(parseDork('').valid, false);
  assert.equal(parseDork('   ').valid, false);
  assert.equal(parseDork('site:example.com').valid, true);
});
