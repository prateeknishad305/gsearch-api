'use strict';

const { load } = require('cheerio');
const { http, nextUserAgent, decodeBingUrl } = require('../http');

const name = 'bing';

function parse(html) {
  const $ = load(html, { scriptingEnabled: false });
  const results = [];
  const seen = new Set();

  $('li.b_algo').each((_, el) => {
    const $r = $(el);
    const $a = $r.find('h2 a').first();
    const title = $a.text().trim();
    const url = decodeBingUrl($a.attr('href') || '');
    if (!title || !url || seen.has(url)) return;
    const snippet = $r.find('.b_caption p, p').first().text().trim();
    seen.add(url);
    results.push({ title, url, snippet });
  });

  return results;
}

async function search({ query, num = 10, hl = 'en', gl = 'us', start = 0 }) {
  const params = new URLSearchParams({ q: query, count: String(num) });
  if (gl) params.set('cc', gl);
  if (hl) params.set('setlang', hl);
  if (start > 0) params.set('first', String(start + 1));
  const url = `https://www.bing.com/search?${params.toString()}`;
  const res = await http.get(url, {
    headers: {
      'user-agent': nextUserAgent(),
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  const results = parse(res.body);
  if (results.length === 0) {
    const e = new Error('Bing returned no results (blocked or changed markup).');
    e.code = 'EMPTY_RESULTS';
    throw e;
  }
  return { results: results.slice(0, num) };
}

module.exports = { name, search, parse };
