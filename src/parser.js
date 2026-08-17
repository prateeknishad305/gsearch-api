'use strict';

const { load } = require('cheerio');

function cleanGoogleUrl(href) {
  if (!href) return null;
  if (href.startsWith('/url?q=')) {
    try {
      const raw = href.slice('/url?q='.length).split('&')[0];
      const target = decodeURIComponent(raw);
      if (target && /^https?:\/\//i.test(target)) return target;
    } catch {
      return null;
    }
    return null;
  }
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  return null;
}

function parseGoogleResults(html) {
  const $ = load(html, { scriptingEnabled: false });
  const results = [];
  const seen = new Set();

  $('h3').each((_, el) => {
    const $h3 = $(el);
    const title = $h3.text().trim();
    if (!title) return;

    const $anchor = $h3.closest('a[href]');
    const url = cleanGoogleUrl($anchor.attr('href'));
    if (!url || seen.has(url)) return;

    let snippet = '';
    let $container = $h3.closest('div.g, div[data-sncf], div[jscontroller]');
    if ($container.length === 0) {
      $container = $anchor.parent();
    }
    if ($container.length > 0) {
      const selectors = [
        'div.VwiC3b',
        'div[data-sncf]',
        'span.aCOpRe',
        'div[data-content-feature="1"]',
        'div.MUxGbd',
      ];
      for (const sel of selectors) {
        const $snippet = $container.find(sel).first();
        const text = $snippet.text().trim();
        if (text) {
          snippet = text;
          break;
        }
      }
    }

    seen.add(url);
    results.push({ title, url, snippet });
  });

  return results;
}

module.exports = { parseGoogleResults, cleanGoogleUrl };
