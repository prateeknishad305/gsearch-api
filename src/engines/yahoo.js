'use strict';

const { load } = require('cheerio');
const { http, nextUserAgent, decodeYahooUrl } = require('../http');

const name = 'yahoo';

function parse(html) {
  const $ = load(html, { scriptingEnabled: false });
  const results = [];
  const seen = new Set();

  $('div.algo, div#web ol li, ol#web > li').each((_, el) => {
    const $r = $(el);
    const $a = $r.find('h3 a, h3.title a, a').first();
    const title = $a.text().trim();
    const url = decodeYahooUrl($a.attr('href') || '');
    if (!title || !url || seen.has(url)) return;
    const snippet = $r.find('.compText, div[class*="complementary"], p').first().text().trim();
    seen.add(url);
    results.push({ title, url, snippet });
  });

  return results;
}

async function search({ query, num = 10, hl = 'en', gl = 'us' }) {
  const params = new URLSearchParams({ p: query, n: String(num) });
  if (gl) params.set('ei', 'UTF-8');
  const url = `https://search.yahoo.com/search?${params.toString()}`;
  const res = await http.get(url, {
    headers: {
      'user-agent': nextUserAgent(),
      accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  const results = parse(res.body);
  if (results.length === 0) {
    const e = new Error('Yahoo returned no results (consent page or changed markup).');
    e.code = 'EMPTY_RESULTS';
    throw e;
  }
  return { results: results.slice(0, num) };
}

module.exports = { name, search, parse };
