'use strict';

const express = require('express');
const { MultiEngineSearch } = require('./search');
const { names } = require('./engines');
const { parseDork } = require('./dork');

const MAX_QPS = Number(process.env.MAX_QPS || 5);
const CACHE_TTL = Number(process.env.CACHE_TTL_MS || 300000);

const engine = new MultiEngineSearch({ maxQps: MAX_QPS, cacheTtlMs: CACHE_TTL });
const app = express();
app.disable('x-powered-by');
app.use(express.json());

const MAX_NUM = 20;

function parseSearchQuery(req) {
  const q = String(req.query.q || '').trim();
  if (!q) {
    return { error: 'Missing required query parameter "q"' };
  }
  if (q.length > 512) {
    return { error: 'Query too long (max 512 chars)' };
  }
  const num = Math.min(Math.max(1, Number(req.query.num) || 10), MAX_NUM);
  const start = Math.max(0, Number(req.query.start) || 0);
  const hl = String(req.query.hl || 'en').slice(0, 8);
  const gl = String(req.query.gl || 'us').slice(0, 8);
  return { q, num, start, hl, gl };
}

function resolveEngines(req) {
  const raw = req.query.engine || 'all';
  const requested = Array.isArray(raw) ? raw : String(raw).split(',');
  const cleaned = requested.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  if (cleaned.includes('all')) return { engines: names(), ok: true };
  const valid = cleaned.filter((n) => names().includes(n));
  if (valid.length === 0) {
    return { error: `Unknown engine. Available: ${names().join(', ')} or "all"` };
  }
  return { engines: valid, ok: true };
}

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', engines: names(), cachedEntries: engine.cache.size() });
});

app.get('/api/search', async (req, res, next) => {
  try {
    const parsed = parseSearchQuery(req);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }
    const engineSel = resolveEngines(req);
    if (!engineSel.ok) {
      return res.status(400).json({ error: engineSel.error });
    }

    const opts = { num: parsed.num, start: parsed.start, hl: parsed.hl, gl: parsed.gl };
    const isAll = engineSel.engines.length > 1;

    if (!isAll) {
      const single = engineSel.engines[0];
      const data = await engine.search(single, parsed.q, opts);
      return res.json({
        query: parsed.q,
        engine: single,
        cached: data.cached,
        count: data.results.length,
        results: data.results,
      });
    }

    const data = await engine.searchAll(parsed.q, opts, engineSel.engines);
    res.json({
      query: parsed.q,
      engines: data.engines,
      successful: data.successful,
      failed: data.failed,
      count: data.count,
      results: data.results,
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/dorks', async (req, res, next) => {
  try {
    const parsed = parseSearchQuery(req);
    if (parsed.error) {
      return res.status(400).json({ error: parsed.error });
    }
    const targetUrls = Math.min(Math.max(1, Number(req.query.urls) || 20), 50);
    const dork = parseDork(parsed.q);
    const engineSel = resolveEngines(req);
    if (!engineSel.ok) {
      return res.status(400).json({ error: engineSel.error });
    }

    const opts = {
      num: Math.min(Math.max(5, targetUrls), MAX_NUM),
      start: parsed.start,
      hl: parsed.hl,
      gl: parsed.gl,
    };
    const t0 = Date.now();
    const data = await engine.searchAll(parsed.q, opts, engineSel.engines);
    const durationMs = Date.now() - t0;

    res.json({
      query: parsed.q,
      dork,
      urls: data.results.slice(0, targetUrls),
      count: Math.min(data.results.length, targetUrls),
      duration_ms: durationMs,
      engines: data.engines,
      successful: data.successful,
      failed: data.failed,
    });
  } catch (err) {
    next(err);
  }
});

app.get('/api/batch', async (req, res, next) => {
  try {
    let queries = req.query.q;
    if (!queries || (Array.isArray(queries) && queries.length === 0)) {
      return res.status(400).json({ error: 'Missing required query parameter "q" (repeat ?q= for each query)' });
    }
    if (!Array.isArray(queries)) queries = [queries];
    if (queries.length > 10) {
      return res.status(400).json({ error: 'Too many queries (max 10 per batch request)' });
    }
    const engineSel = resolveEngines(req);
    if (!engineSel.ok) {
      return res.status(400).json({ error: engineSel.error });
    }
    const opts = {
      num: Math.min(Math.max(1, Number(req.query.num) || 10), MAX_NUM),
      start: Math.max(0, Number(req.query.start) || 0),
      hl: String(req.query.hl || 'en').slice(0, 8),
      gl: String(req.query.gl || 'us').slice(0, 8),
    };
    const results = await Promise.all(
      queries.map(async (q) => {
        const query = String(q).slice(0, 512);
        if (engineSel.engines.length > 1) {
          const data = await engine.searchAll(query, opts, engineSel.engines);
          return { query, ...data };
        }
        const single = engineSel.engines[0];
        const data = await engine.search(single, query, opts);
        return { query, engine: single, cached: data.cached, count: data.results.length, results: data.results };
      })
    );
    res.json({ count: results.length, results });
  } catch (err) {
    next(err);
  }
});

app.use('/api', (req, res) => {
  res.status(404).json({
    error: 'Not found. Try GET /api/search?q=hello&engine=all or /api/search?q=hello&engine=duckduckgo',
  });
});

app.use((err, _req, res, _next) => {
  const status =
    err.code === 'RATE_LIMITED' ? 429
      : err.code === 'UNKNOWN_ENGINE' ? 400
        : err.code === 'BLOCKED' || err.code === 'EMPTY_RESULTS' ? 502
          : 500;
  res.status(status).json({ error: err.message || 'Internal server error', code: err.code || 'INTERNAL' });
});

module.exports = app;
