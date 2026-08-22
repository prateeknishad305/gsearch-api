'use strict';

require('dotenv').config({ quiet: true });

const got = require('got').default;
const https = require('https');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { HttpProxyAgent } = require('http-proxy-agent');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0',
];

const AGENT = new https.Agent({ keepAlive: true, maxSockets: 64, maxFreeSockets: 32 });

let uaIndex = Math.floor(Math.random() * USER_AGENTS.length);

function nextUserAgent() {
  const ua = USER_AGENTS[uaIndex % USER_AGENTS.length];
  uaIndex += 1;
  return ua;
}

function parseProxyList(raw) {
  if (!raw) return [];
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//.test(s));
}

function agentFor(proxyUrl) {
  if (!proxyUrl) return { https: AGENT };
  return {
    http: new HttpProxyAgent(proxyUrl),
    https: new HttpsProxyAgent(proxyUrl),
  };
}

const http = got.extend({
  timeout: { request: 8000 },
  headers: {
    accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'accept-language': 'en-US,en;q=0.9',
    'cache-control': 'no-cache',
  },
  retry: {
    limit: 2,
    methods: ['GET', 'POST'],
    statusCodes: [429, 500, 502, 503, 504],
    maxRetryAfter: 1500,
  },
  followRedirect: true,
  throwHttpErrors: true,
});

const proxied = new Proxy(http, {
  get(target, prop) {
    if (typeof prop !== 'string' || !['get', 'post', 'head', 'delete', 'patch', 'put', 'request'].includes(prop)) {
      const value = target[prop];
      return typeof value === 'function' ? value.bind(target) : value;
    }
    return (url, options = {}) => {
      const { proxy, ...rest } = options;
      const pool = parseProxyList(proxy);
      const proxyUrl = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      return target[prop](url, { ...rest, agent: agentFor(proxyUrl) });
    };
  },
});

function decodeGoogleRedirectUrl(href) {
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

function decodeDdgRedirect(href) {
  if (!href) return null;
  try {
    if (href.startsWith('http') || href.startsWith('//')) {
      const u = new URL(href, 'https://duckduckgo.com');
      const uddg = u.searchParams.get('uddg');
      return uddg && /^https?:\/\//i.test(uddg) ? uddg : u.href;
    }
  } catch {
    /* ignore */
  }
  return href;
}

function decodeBingUrl(href) {
  if (!href) return null;
  if (href.includes('/ck/a') && href.includes('&u=')) {
    try {
      const params = new URLSearchParams(href.slice(href.indexOf('?') + 1));
      let encoded = params.get('u');
      if (encoded) {
        encoded = encoded.replace(/^a[13]/, '');
        const decoded = Buffer.from(encoded, 'base64url').toString('utf8');
        if (/^https?:\/\//i.test(decoded)) return decoded;
      }
    } catch {
      /* ignore */
    }
  }
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  return null;
}

function decodeYahooUrl(href) {
  if (!href) return null;
  if (href.includes('/RU=')) {
    try {
      const match = href.match(/\/RU=([^/]+)/);
      if (match) {
        const decoded = decodeURIComponent(match[1]);
        if (/^https?:\/\//i.test(decoded)) return decoded;
      }
    } catch {
      /* ignore */
    }
  }
  if (href.startsWith('http://') || href.startsWith('https://')) return href;
  return null;
}

module.exports = {
  http: proxied,
  nextUserAgent,
  decodeGoogleRedirectUrl,
  decodeDdgRedirect,
  decodeBingUrl,
  decodeYahooUrl,
};
