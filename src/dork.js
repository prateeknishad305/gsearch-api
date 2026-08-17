'use strict';

const KNOWN_OPERATORS = new Set([
  'site',
  'intitle',
  'allintitle',
  'inurl',
  'allinurl',
  'intext',
  'allintext',
  'filetype',
  'ext',
  'inanchor',
  'inbody',
  'link',
  'cache',
  'related',
  'info',
  'define',
]);

const TOKEN_RE = /([a-zA-Z]+):"([^"]+)"|"([^"]+)"|([a-zA-Z]+):(\S+)|(^|\s)-(\S+)/g;

function pushTerms(terms, text) {
  for (const t of String(text).split(/\s+/)) {
    if (t) terms.push(t);
  }
}

function parseDork(query) {
  const original = String(query || '').trim();
  const operators = [];
  const exactPhrases = [];
  const exclusions = [];
  const terms = [];

  TOKEN_RE.lastIndex = 0;
  let lastIndex = 0;
  let m;
  while ((m = TOKEN_RE.exec(original)) !== null) {
    if (m.index > lastIndex) {
      pushTerms(terms, original.slice(lastIndex, m.index));
    }
    if (m[1]) {
      const key = m[1].toLowerCase();
      operators.push({ name: key, value: m[2], unsupported: !KNOWN_OPERATORS.has(key) });
    } else if (m[3]) {
      exactPhrases.push(m[3].trim());
    } else if (m[4]) {
      const key = m[4].toLowerCase();
      operators.push({ name: key, value: m[5], unsupported: !KNOWN_OPERATORS.has(key) });
    } else if (m[7]) {
      exclusions.push(m[7]);
    }
    lastIndex = TOKEN_RE.lastIndex;
  }
  if (lastIndex < original.length) {
    pushTerms(terms, original.slice(lastIndex));
  }

  return {
    original,
    operators,
    exactPhrases,
    exclusions,
    terms,
    valid: operators.length + exactPhrases.length + exclusions.length + terms.length > 0,
  };
}

module.exports = { parseDork, KNOWN_OPERATORS };
