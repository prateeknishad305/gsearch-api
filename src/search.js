'use strict';

const { TtlCache } = require('./cache');
const { names, get } = require('./engines');

class RateLimiter {
  constructor(maxPerSecond = 5) {
    this.maxPerSecond = maxPerSecond;
    this.tokens = maxPerSecond;
    this.lastRefill = Date.now();
    this.waiters = [];
  }

  async acquire() {
    this._refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }
    await new Promise((resolve) => this.waiters.push(resolve));
  }

  _refill() {
    const now = Date.now();
    const delta = (now - this.lastRefill) / 1000;
    this.lastRefill = now;
    this.tokens = Math.min(this.maxPerSecond, this.tokens + delta * this.maxPerSecond);
    while (this.tokens >= 1 && this.waiters.length > 0) {
      this.tokens -= 1;
      this.waiters.shift()();
    }
  }
}

class MultiEngineSearch {
  constructor(options = {}) {
    this.cache = new TtlCache(options.cacheTtlMs, options.cacheMaxEntries);
    this.maxQps = options.maxQps ?? 5;
    this.limiters = new Map();
  }

  _limiter(name) {
    if (!this.limiters.has(name)) {
      this.limiters.set(name, new RateLimiter(this.maxQps));
    }
    return this.limiters.get(name);
  }

  async search(engineName, query, options = {}) {
    const engine = get(engineName);
    if (!engine) {
      const e = new Error(
        `Unknown engine "${engineName}". Available: ${names().join(', ')}`
      );
      e.code = 'UNKNOWN_ENGINE';
      throw e;
    }

    const cacheKey = JSON.stringify([engineName, query, options]);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { engine: engineName, cached: true, results: cached };
    }

    await this._limiter(engineName).acquire();
    let results;
    try {
      ({ results } = await engine.search({ query, ...options }));
    } catch (err) {
      if (err.name === 'HTTPError') {
        const status = err.response?.statusCode;
        if (status === 429) {
          const e = new Error(`Engine "${engineName}" rate-limited the request (HTTP 429).`);
          e.code = 'RATE_LIMITED';
          throw e;
        }
        if (status === 403 || status === 503) {
          const e = new Error(`Engine "${engineName}" blocked the request (HTTP ${status}).`);
          e.code = 'BLOCKED';
          throw e;
        }
      }
      throw err;
    }

    if (!Array.isArray(results) || results.length === 0) {
      const e = new Error(`Engine "${engineName}" returned no results.`);
      e.code = 'EMPTY_RESULTS';
      throw e;
    }

    this.cache.set(cacheKey, results);
    return { engine: engineName, cached: false, results };
  }

  async searchAll(query, options = {}, engineNames = names()) {
    const settled = await Promise.allSettled(
      engineNames.map((name) =>
        this.search(name, query, options).catch((err) => {
          err.engineName = name;
          throw err;
        })
      )
    );
    const ok = [];
    const errors = [];
    for (const s of settled) {
      if (s.status === 'fulfilled') {
        ok.push(s.value);
      } else {
        errors.push({
          engine: s.reason?.engineName,
          code: s.reason?.code || 'ERROR',
          message: s.reason?.message,
        });
      }
    }

    const seen = new Set();
    const merged = [];
    for (const entry of ok) {
      for (const r of entry.results) {
        if (seen.has(r.url)) continue;
        seen.add(r.url);
        merged.push({ ...r, engine: entry.engine });
      }
    }

    return {
      engines: engineNames,
      successful: ok.map((e) => e.engine),
      failed: errors,
      count: merged.length,
      results: merged,
    };
  }
}

module.exports = { MultiEngineSearch };
