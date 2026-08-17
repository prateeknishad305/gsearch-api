'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseGoogleResults } = require('../src/parser');
const ddg = require('../src/engines/duckduckgo');
const bing = require('../src/engines/bing');
const yahoo = require('../src/engines/yahoo');

test('google parser extracts title, url, snippet', () => {
  const html = `
    <html><body>
    <div class="g">
      <div>
        <a href="/url?q=https%3A%2F%2Fnodejs.org%2F&sa=U&ved=1"><h3>Node.js</h3></a>
        <div class="VwiC3b">Node.js runtime homepage</div>
      </div>
    </div>
    <div class="g">
      <div>
        <a href="/url?q=https%3A%2F%2Fen.wikipedia.org%2Fwiki%2FNode.js&sa=U"><h3>Node.js - Wikipedia</h3></a>
        <div class="VwiC3b">Node.js article</div>
      </div>
    </div>
    </body></html>`;
  const results = parseGoogleResults(html);
  assert.equal(results.length, 2);
  assert.equal(results[0].title, 'Node.js');
  assert.equal(results[0].url, 'https://nodejs.org/');
  assert.equal(results[0].snippet, 'Node.js runtime homepage');
});

test('google parser ignores non-http links and dedupes urls', () => {
  const html = `
    <div class="g">
      <a href="/search?q=something"><h3>Internal link</h3></a>
      <a href="https://example.com/a"><h3>Dup title</h3></a>
      <div class="VwiC3b">s</div>
    </div>
    <div class="g">
      <a href="https://example.com/a"><h3>Same url</h3></a>
    </div>`;
  const results = parseGoogleResults(html);
  assert.equal(results.length, 1);
  assert.equal(results[0].url, 'https://example.com/a');
});

test('duckduckgo parser extracts results and decodes redirects', () => {
  const html = `
    <div id="links">
      <div class="result">
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fnodejs.org%2F&rut=x">Node.js</a>
        <a class="result__snippet" href="//duckduckgo.com/l/?uddg=1">A runtime homepage</a>
      </div>
      <div class="result">
        <a class="result__a" href="https://example.com/">Example</a>
        <a class="result__snippet" href="#">Nothing to see</a>
      </div>
    </div>`;
  const results = ddg.parse(html);
  assert.equal(results.length, 2);
  assert.equal(results[0].url, 'https://nodejs.org/');
  assert.equal(results[0].snippet, 'A runtime homepage');
});

test('bing parser extracts results and decodes ck/a redirects', () => {
  const b64 = Buffer.from('https://openai.com/').toString('base64url');
  const html = `
    <ol id="b_results">
      <li class="b_algo">
        <h2><a href="https://www.bing.com/ck/a?!&&p=x&u=a1${b64}&ntb=1">OpenAI</a></h2>
        <div class="b_caption"><p>AI research lab</p></div>
      </li>
    </ol>`;
  const results = bing.parse(html);
  assert.equal(results.length, 1);
  assert.equal(results[0].url, 'https://openai.com/');
  assert.equal(results[0].title, 'OpenAI');
  assert.equal(results[0].snippet, 'AI research lab');
});

test('yahoo parser extracts results and decodes RU redirects', () => {
  const html = `
    <div id="web">
      <ol>
        <li>
          <div class="algo">
            <h3><a href="https://r.search.yahoo.com/_ylt=Abc/RU=https%3A%2F%2Fopenai.com%2F/RK=2/RS=xyz">OpenAI</a></h3>
            <div class="compText">AI company</div>
          </div>
        </li>
      </ol>
    </div>`;
  const results = yahoo.parse(html);
  assert.equal(results.length, 1);
  assert.equal(results[0].url, 'https://openai.com/');
  assert.equal(results[0].snippet, 'AI company');
});
