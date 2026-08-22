'use strict';

const { load } = require('cheerio');
const { http, nextUserAgent } = require('../http');

const name = 'startpage';

function parse(html) {
  const $ = load(html, { scriptingEnabled: false });
  const results = [];
  const seen = new Set();

  $('.w-gl__result, .result, div[data-testid="mainline"]').each((_, el) => {
    const $r = $(el);
    const $a = $r.find('a.w-gl__result-title, a.result-title, h2 a, a[href]').first();
    const title = $a.text().trim();
    let url = $a.attr('href') || '';
    if (!title || !/^https?:\/\//i.test(url) || seen.has(url)) return;
    const snippet = $r.find('p.w-gl__description, .result-description, p').first().text().trim();
    seen.add(url);
    results.push({ title, url, snippet });
  });

  return results;
}

async function search({ query, num = 10, hl = 'en', gl = 'us', proxy }) {
  const url = 'https://www.startpage.com/sp/search';
  const res = await http.post(url, {
    proxy,
    headers: {
      'user-agent': nextUserAgent(),
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    form: { query },
  });
  const results = parse(res.body);
  if (results.length === 0) {
    const e = new Error('Startpage returned no results (challenge page or changed markup).');
    e.code = 'EMPTY_RESULTS';
    throw e;
  }
  return { results: results.slice(0, num) };
}

module.exports = { name, search, parse };
