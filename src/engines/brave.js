'use strict';

const { load } = require('cheerio');
const { http, nextUserAgent } = require('../http');

const name = 'brave';

function parse(html) {
  const $ = load(html, { scriptingEnabled: false });
  const results = [];
  const seen = new Set();

  $('.snippet').each((_, el) => {
    const $r = $(el);
    const $a = $r.find('a[href].snippet-title').first();
    const title = $a.text().trim();
    const url = $a.attr('href') || '';
    if (!title || !/^https?:\/\//i.test(url) || seen.has(url)) return;
    const snippet = $r.find('.snippet-description, .snippet-description p, p').first().text().trim();
    seen.add(url);
    results.push({ title, url, snippet });
  });

  return results;
}

async function search({ query, num = 10, hl = 'en', gl = 'us' }) {
  const params = new URLSearchParams({ q: query, source: 'web' });
  if (gl) params.set('country', gl);
  const url = `https://search.brave.com/search?${params.toString()}`;
  const res = await http.get(url, {
    headers: {
      'user-agent': nextUserAgent(),
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  const results = parse(res.body);
  if (results.length === 0) {
    const e = new Error('Brave returned no results (challenge page or changed markup).');
    e.code = 'EMPTY_RESULTS';
    throw e;
  }
  return { results: results.slice(0, num) };
}

module.exports = { name, search, parse };
