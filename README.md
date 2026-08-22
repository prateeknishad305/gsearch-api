# gsearch-api

Multi-engine search API with **no API key required**. Scrapes the public search-result pages of 8 engines and returns structured JSON. No billing, no keys, no rate-limit contracts.

## Engines

| Engine | Notes |
|--------|-------|
| `google` | Real Google SERP. Often gated for datacenter IPs (JS-required page); works from residential IPs. |
| `duckduckgo` | HTML endpoint, no JS needed. Reliable from most IPs. |
| `bing` | HTML results, no JS needed. Reliable. |
| `yahoo` | HTML results. Reliable. |
| `brave` | Sometimes issues a challenge page to automated traffic. |
| `mojeek` | Actively blocks automated/datacenter networks (HTTP 403). |
| `startpage` | Serves a JS challenge to automated traffic. |
| `qwant` | API returns 403 to datacenter traffic. |

Engines that are blocked from a given IP are reported per-engine in the response (`failed`), and the rest keep working.

## Features

- **No API key** for any engine
- **Fast**: keep-alive connection pool, gzip, in-memory TTL cache, per-engine rate limiter
- **Parallel `all` mode**: query all engines concurrently and merge deduplicated results
- **Batch**: up to 10 queries per request
- Redirect URLs decoded to real destinations (Google `/url?q=`, DuckDuckGo `uddg`, Bing `ck/a`, Yahoo `RU=`)

## Requirements

- Node.js 22 (required by `got` v14, which is ESM-only — this also fixes the Vercel serverless crash)

## Install & Run

```bash
npm install
npm start
```

Server starts on `http://localhost:3000`.

## API

### GET /health

```bash
curl http://localhost:3000/health
```

### GET /api/search

| Param | Default | Description |
|-------|---------|-------------|
| `q`      | (required) | Search query |
| `engine` | `all` | One of the engines above, comma-separated list, or `all` |
| `num`    | `10` | Results per engine (1-20) |
| `start`  | `0` | Pagination offset (Google/Bing) |
| `hl`     | `en` | Interface language |
| `gl`     | `us` | Country |
| `proxy`  | *(none)* | Optional `http://` or `https://` proxy URL to route requests through (see below) |

Single engine:

```bash
curl "http://localhost:3000/api/search?q=openai&engine=duckduckgo&num=5"
```

```json
{
  "query": "openai",
  "engine": "duckduckgo",
  "cached": false,
  "count": 5,
  "results": [
    {
      "title": "OpenAI",
      "url": "https://openai.com/",
      "snippet": "OpenAI is an AI research and deployment company..."
    }
  ]
}
```

All engines (parallel, merged, deduplicated):

```bash
curl "http://localhost:3000/api/search?q=openai&engine=all&num=3"
```

```json
{
  "query": "openai",
  "engines": ["google", "duckduckgo", "bing", "brave", "mojeek", "startpage", "yahoo", "qwant"],
  "successful": ["duckduckgo", "bing", "yahoo"],
  "failed": [
    { "engine": "google", "code": "BLOCKED", "message": "..." }
  ],
  "count": 9,
  "results": [
    { "title": "...", "url": "https://...", "snippet": "...", "engine": "duckduckgo" }
  ]
}
```

### GET /api/dorks

Fast search tuned for Google-dork style queries. Runs all engines in parallel, parses the dork into structured operators, and returns up to `urls` unique URLs with measured latency.

| Param | Default | Description |
|-------|---------|-------------|
| `q`      | (required) | Query — any text or dork syntax |
| `urls`   | `20` | Target number of unique URLs (1-50) |
| `engine` | `all` | Engine(s) to use |
| `hl` / `gl` | `en` / `us` | Locale |
| `proxy`  | *(none)* | Optional `http://` or `https://` proxy URL (see below) |

```bash
curl "http://localhost:3000/api/dorks?q=site:github.com intitle:api -openai&urls=20"
```

```json
{
  "query": "site:github.com intitle:api -openai",
  "dork": {
    "operators": [
      { "name": "site", "value": "github.com", "unsupported": false },
      { "name": "intitle", "value": "api", "unsupported": false }
    ],
    "exactPhrases": [],
    "exclusions": ["openai"],
    "terms": []
  },
  "urls": [ { "title": "...", "url": "https://...", "snippet": "...", "engine": "duckduckgo" } ],
  "count": 20,
  "duration_ms": 3984,
  "engines": ["google", "duckduckgo", "bing", "brave", "mojeek", "startpage", "yahoo", "qwant"],
  "successful": ["duckduckgo", "bing"],
  "failed": [ { "engine": "google", "code": "BLOCKED", "message": "..." } ]
}
```

Supported dork operators: `site:`, `intitle:`, `allintitle:`, `inurl:`, `allinurl:`, `intext:`, `allintext:`, `filetype:`/`ext:`, `inanchor:`, `inbody:`, `link:`, `cache:`, `related:`, `info:`, `define:`. Also parsed: `"exact phrase"`, `-excluded`, plain terms. The raw query is passed through verbatim to every engine, so operators work where each engine supports them (Bing/DDG honor most).

### GET /api/batch

Multiple queries in parallel. Repeat `q` (max 10). Accepts the same `engine`, `num`, `hl`, `gl`, `proxy` params.

```bash
curl "http://localhost:3000/api/batch?q=openai&q=google&q=aws&engine=all&num=3"
```

## Using a proxy

No proxy is configured on the server (remove any `PROXY_URLS` / `PROXY_URL` / `PROXY_USER` / `PROXY_PASS` / `PROXY_ROTATE` env vars). Instead, each caller can send **their own** proxy URL as a query parameter, which is applied only to that request:

```bash
curl "http://localhost:3000/api/search?q=openai&engine=duckduckgo&proxy=http://user:pass@host:port"
```

- Accepts a single `http://` or `https://` proxy URL, or a comma-separated list (`a,b,c`) — one is picked randomly per engine request.
- Works on `/api/search`, `/api/dorks`, and `/api/batch`.
- When no `proxy` param is sent, requests go out directly from the server (recommended for Vercel).

## Configuration

Environment variables (see `.env.example`):

| Var | Default | Description |
|-----|---------|-------------|
| `PORT` | `3000` | HTTP port |
| `MAX_QPS` | `5` | Max requests per second per engine |
| `CACHE_TTL_MS` | `300000` | Result cache TTL in ms |

## Tests

```bash
npm test
```

## Disclaimer

- Scraping search engines violates their ToS and can get the running IP blocked. This project is intended for prototyping, personal automation, and educational use — keep `MAX_QPS` low.
- Search engines change their markup and anti-bot defenses frequently; parsers may need updates.
- Not affiliated with or endorsed by Google, DuckDuckGo, Bing, Yahoo, Brave, Mojeek, Startpage, or Qwant.
