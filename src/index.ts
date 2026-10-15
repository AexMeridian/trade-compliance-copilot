import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { bodyLimit } from 'hono/body-limit';
import type { Env } from './types/env.js';
import { casesRoute } from './routes/cases.js';
import { classificationRoute } from './routes/classification.js';
import { originRoute } from './routes/origin.js';
import { screeningRoute } from './routes/screening.js';
import { determinationRoute } from './routes/determination.js';
import { pulseRoute } from './routes/pulse.js';
import { scheduled } from './scheduled.js';
import { edgeCache } from './lib/edgeCache.js';
import { conditionalGet, FEED_PATHS } from './routes/pulse/feeds.js';
import { normalizeFilters } from './lib/feed.js';

const app = new Hono<{ Bindings: Env }>();

// Send plain-HTTP visitors to HTTPS (the request URL keeps the scheme the client used). Skipped on localhost so
// local development still works.
app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  if (url.protocol === 'http:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
    url.protocol = 'https:';
    return c.redirect(url.toString(), 301);
  }
  await next();
});

// No legitimate request to this API is larger than a few kilobytes of JSON; refusing big bodies early keeps a
// single client from making the Worker read and parse megabytes.
app.use('/api/*', bodyLimit({ maxSize: 32 * 1024, onError: (c) => c.json({ error: 'That request is too large.' }, 413) }));

// Baseline hardening headers on every API response (static pages get theirs
// from frontend/public/_headers). API responses are JSON/XML, never framed.
app.use('/api/*', secureHeaders({ crossOriginResourcePolicy: 'same-site', xFrameOptions: 'DENY', referrerPolicy: 'no-referrer' }));

// The Pulse read API is public and unauthenticated. Per-IP cap so one client
// can't run the site out of its Workers request quota or hammer D1; a real
// reader makes a handful of calls per visit, far under this.
app.use('/api/pulse/*', async (c, next) => {
  const key = c.req.header('cf-connecting-ip') ?? 'unknown';
  const { success } = await c.env.PULSE_RATE_LIMITER.limit({ key });
  if (!success) {
    c.header('Retry-After', '30');
    return c.json({ error: 'Too many requests. Please wait a moment and try again.' }, 429);
  }
  return next();
});

// Slow-changing, comparatively expensive reads are cached at the edge for 5 minutes
// (see lib/edgeCache.ts for why, and which endpoints must NOT be listed here).
const EDGE_CACHED = ['connections', 'convergence', 'related', 'tariffs', 'sanctions', 'gta', 'wro', 'coverage', 'nato-defense', 'cofer', 'tic', 'recent-listings', 'export-control-chart', 'active-measures', 'live-arcs'];
for (const p of EDGE_CACHED) app.use(`/api/pulse/${p}`, edgeCache(300));
// A country page costs ~15,000 rows read uncached and there are ~170 of them (a crawler can visit them all), so it is held for an hour.
app.use('/api/pulse/country/*', edgeCache(3600));
// Startup calls made by every page view (and the header ticker): short windows keep a burst of visitors to one read per window.
app.use('/api/pulse/home', edgeCache(60));
for (const p of ['markets', 'news', 'summary', 'tempo']) app.use(`/api/pulse/${p}`, edgeCache(300));
// Sanctions lists reload weekly and this scans all four tables, so it is held at the edge for six hours.
app.use('/api/pulse/sanction-counts', edgeCache(21600));
app.use('/api/pulse/data-status', edgeCache(300));
app.use('/api/pulse/stats', edgeCache(21600));

// Feeds are polled by readers around the clock, so they get a longer edge window, a cache
// key built from the validated query (junk or reordered parameters share one entry), and
// If-None-Match / If-Modified-Since -> 304. conditionalGet is registered first so it wraps
// the cache and also answers hits.
const feedCacheKey = (url: URL) => {
  const parsed = normalizeFilters((name) => url.searchParams.get(name));
  return parsed.ok ? `${url.origin}${url.pathname}${parsed.canonical ? `?${parsed.canonical}` : ''}` : url.toString();
};
for (const p of FEED_PATHS) {
  app.use(`/api/pulse/${p}`, conditionalGet);
  app.use(`/api/pulse/${p}`, edgeCache(600, feedCacheKey));
}

// Short, stable feed addresses for readers and for sharing. Forwarded in-process (not
// redirected) so there is no extra hop; the forwarded request still passes the rate limiter.
const FEED_ALIASES: Record<string, string> = { '/rss.xml': 'rss', '/atom.xml': 'atom', '/feed.json': 'feed.json' };
for (const [alias, target] of Object.entries(FEED_ALIASES)) {
  app.get(alias, (c) => {
    const url = new URL(c.req.url);
    url.pathname = `/api/pulse/${target}`;
    return app.fetch(new Request(url, c.req.raw), c.env, c.executionCtx);
  });
}

// Public Pulse reads are safe for a browser to reuse for a minute (switching tabs
// or reopening a country re-asks for the same data). Routes that know better set
// their own Cache-Control first (e.g. /home, /connections); this only fills the gap.
app.use('/api/pulse/*', async (c, next) => {
  await next();
  if (c.req.method === 'GET' && c.res.status === 200 && !c.res.headers.has('Cache-Control')) {
    c.res.headers.set('Cache-Control', 'public, max-age=60');
  }
});

const CLAUDE_CALLING_SUFFIXES = ['/classification', '/origin', '/screening', '/determination'];

// This is a public demo Worker with no auth in front of it, and these 4
// routes are the only ones that call the Anthropic API -- without a limit
// here, a bot finding the URL could hammer them and run up unbounded Claude
// spend on the deploying account's key. Every other route (health check,
// case reads, samples) is a plain D1 read and stays unthrottled.
//
// Besides the per-visitor limit there is a daily ceiling across everyone (CLAUDE_DAILY_CAP, default 300
// Claude-calling requests per UTC day), so a coordinated burst can never run up an unbounded bill. It is one
// counter row in D1 per day. If the counter itself cannot be read, requests are allowed rather than blocked.
async function claudeCapReached(env: Env): Promise<boolean> {
  const cap = Number(env.CLAUDE_DAILY_CAP ?? 300);
  if (!Number.isFinite(cap) || cap <= 0) return false;
  try {
    const day = new Date().toISOString().slice(0, 10);
    const row = await env.DB.prepare(
      `INSERT INTO pulse_feed_state (source_key, last_note) VALUES (?1, '1')
       ON CONFLICT(source_key) DO UPDATE SET last_note = CAST(CAST(pulse_feed_state.last_note AS INTEGER) + 1 AS TEXT)
       RETURNING last_note`
    )
      .bind(`claude-calls:${day}`)
      .first<{ last_note: string }>();
    return Number(row?.last_note ?? 0) > cap;
  } catch {
    return false;
  }
}

app.use('/api/cases/*', async (c, next) => {
  if (c.req.method === 'POST' && CLAUDE_CALLING_SUFFIXES.some((s) => c.req.path.endsWith(s))) {
    const key = c.req.header('cf-connecting-ip') ?? 'unknown';
    const { success } = await c.env.CLAUDE_RATE_LIMITER.limit({ key });
    if (!success) {
      return c.json({ error: 'Rate limit exceeded. Please wait a moment before trying again.' }, 429);
    }
    if (await claudeCapReached(c.env)) {
      return c.json({ error: "The calculator has reached its daily capacity for AI-assisted checks. Please try again tomorrow." }, 503);
    }
  }
  return next();
});

// The only two routes that let an anonymous visitor write a row: creating a calculator case and saving
// a citable snapshot. A modest per-IP cap keeps a bot from burning the database's daily write allowance.
const limitWrites: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  if (c.req.method === 'POST') {
    const { success } = await c.env.WRITE_RATE_LIMITER.limit({ key: c.req.header('cf-connecting-ip') ?? 'unknown' });
    if (!success) {
      c.header('Retry-After', '60');
      return c.json({ error: 'Too many requests. Please wait a minute and try again.' }, 429);
    }
  }
  return next();
};
app.use('/api/cases', limitWrites);
app.use('/api/pulse/snapshots', limitWrites);

app.route('/api/cases', casesRoute);
app.route('/api/cases', classificationRoute);
app.route('/api/cases', originRoute);
app.route('/api/cases', screeningRoute);
app.route('/api/cases', determinationRoute);
app.route('/api/pulse', pulseRoute);

app.get('/api/health', (c) => c.json({ ok: true }));

// Without this, an uncaught exception (a D1 outage, a quota day, anything
// unexpected) falls through to Hono's default handler: a bare "Internal
// Server Error" text response, which lib/api.ts's request() can't parse as
// JSON and therefore reports as a generic, unhelpful message everywhere it's
// surfaced. This keeps every route's error contract the same ({ error }, as
// json) and logs the real cause to the Worker's own log instead of the client.
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Something went wrong on our end. Please try again shortly.' }, 500);
});

export default {
  fetch: app.fetch,
  scheduled,
};
