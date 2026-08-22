'use strict';

const { http, nextUserAgent } = require('../http');

const name = 'qwant';

function parse(payload) {
  const results = [];
  const seen = new Set();
  const items = payload?.data?.result?.items?.mainline || [];
  for (const item of items) {
    const { title, url, desc } = item || {};
    if (!title || !url || seen.has(url)) continue;
    if (item.type !== 'web') continue;
    seen.add(url);
    results.push({ title: String(title).trim(), url, snippet: String(desc || '').trim() });
  }
  return results;
}

async function search({ query, num = 10, hl = 'en', gl = 'us', proxy }) {
  const locale = `${gl || 'us'}_${hl === 'fr' ? 'FR' : hl === 'de' ? 'DE' : 'US'}`;
  const params = new URLSearchParams({
    q: query,
    count: String(num),
    locale,
    offset: '0',
    device: 'desktop',
    safesearch: '0',
  });
  const url = `https://api.qwant.com/v3/search/web?${params.toString()}`;
  const res = await http.get(url, {
    proxy,
    headers: {
      'user-agent': nextUserAgent(),
      accept: 'application/json',
      referer: 'https://www.qwant.com/',
    },
  });
  let payload;
  try {
    payload = JSON.parse(res.body);
  } catch {
    const e = new Error('Qwant returned a non-JSON response.');
    e.code = 'EMPTY_RESULTS';
    throw e;
  }
  const results = parse(payload);
  if (results.length === 0) {
    const e = new Error('Qwant returned no results.');
    e.code = 'EMPTY_RESULTS';
    throw e;
  }
  return { results: results.slice(0, num) };
}

module.exports = { name, search };
