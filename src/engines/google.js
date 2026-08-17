'use strict';

const { parseGoogleResults } = require('../parser');
const { http, nextUserAgent } = require('../http');

const name = 'google';

async function search({ query, num = 10, hl = 'en', gl = 'us', start = 0 }) {
  const params = new URLSearchParams({
    q: query,
    num: String(Math.min(Math.max(1, num), 20)),
    hl,
    gl,
    start: String(Math.max(0, start)),
  });
  const url = `https://www.google.com/search?${params.toString()}`;
  const res = await http.get(url, {
    headers: { 'user-agent': nextUserAgent(), referer: 'https://www.google.com/' },
  });
  if (res.body.includes('enablejs') && !res.body.includes('<h3')) {
    const e = new Error(
      'Google served the JS-required gate for this IP (common for datacenter IPs). ' +
      'Results are still available via other engines.'
    );
    e.code = 'BLOCKED';
    throw e;
  }
  return { results: parseGoogleResults(res.body) };
}

module.exports = { name, search };
