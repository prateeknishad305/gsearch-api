'use strict';

const { load } = require('cheerio');
const { http, nextUserAgent, decodeDdgRedirect } = require('../http');

const name = 'duckduckgo';

function parse(html) {
  const $ = load(html, { scriptingEnabled: false });
  const results = [];
  const seen = new Set();

  $('#links .result').each((_, el) => {
    const $r = $(el);
    const $a = $r.find('a.result__a').first();
    const title = $a.text().trim();
    const url = decodeDdgRedirect($a.attr('href'));
    if (!title || !url || seen.has(url)) return;
    const snippet = $r.find('a.result__snippet').first().text().trim();
    seen.add(url);
    results.push({ title, url, snippet });
  });

  return results;
}

async function search({ query, num = 10, hl = 'en', gl = 'us', proxy }) {
  const params = new URLSearchParams({ q: query, kl: gl ? `${gl}-${hl}` : 'us-en' });
  const url = `https://html.duckduckgo.com/html/?${params.toString()}`;
  const res = await http.get(url, {
    proxy,
    headers: {
      'user-agent': nextUserAgent(),
      referer: 'https://duckduckgo.com/',
    },
  });
  const results = parse(res.body);
  if (results.length === 0) {
    const e = new Error('DuckDuckGo returned no results (possible anomaly challenge).');
    e.code = 'EMPTY_RESULTS';
    throw e;
  }
  return { results: results.slice(0, num) };
}

module.exports = { name, search, parse };
