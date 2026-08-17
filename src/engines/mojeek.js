'use strict';

const { load } = require('cheerio');
const { http, nextUserAgent } = require('../http');

const name = 'mojeek';

function parse(html) {
  const $ = load(html, { scriptingEnabled: false });
  const results = [];
  const seen = new Set();

  $('ul.results-standard li, li[data-url]').each((_, el) => {
    const $r = $(el);
    const $a = $r.find('.title a, a.title, h2 a').first();
    const title = $a.text().trim();
    const url = $a.attr('href') || '';
    if (!title || !/^https?:\/\//i.test(url) || seen.has(url)) return;
    const snippet = $r.find('p.s, .s, p').first().text().trim();
    seen.add(url);
    results.push({ title, url, snippet });
  });

  return results;
}

async function search({ query, num = 10, hl = 'en', gl = 'us' }) {
  const params = new URLSearchParams({ q: query });
  const url = `https://www.mojeek.com/search?${params.toString()}`;
  const res = await http.get(url, {
    headers: {
      'user-agent': nextUserAgent(),
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  const results = parse(res.body);
  if (results.length === 0) {
    const e = new Error('Mojeek returned no results.');
    e.code = 'EMPTY_RESULTS';
    throw e;
  }
  return { results: results.slice(0, num) };
}

module.exports = { name, search, parse };
