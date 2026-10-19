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
import { ClaudeDailyCapError } from './lib/anthropic.js';
import { edgeCache } from './lib/edgeCache.js';
import { conditionalGet, FEED_PATHS } from './routes/pulse/feeds.js';
import { normalizeFilters } from './lib/feed.js';
import { normalizeCountries } from './lib/power/compute.js';
import { countryCacheKey, pulseCacheKey } from './lib/pulse/cacheKeys.js';
import { KNOWN_COUNTRY_CODES } from './lib/pulse/country.js';

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
// Each key is built from only the parameters the endpoint reads (lib/pulse/cacheKeys.ts), so junk or out-of-range query strings
// share one entry instead of minting new ones (every miss reads thousands of rows).
const EDGE_CACHED = ['connections', 'convergence', 'related', 'tariffs', 'sanctions', 'gta', 'wro', 'coverage', 'nato-defense', 'cofer', 'tic', 'recent-listings', 'export-control-chart', 'active-measures', 'live-arcs'];
for (const p of EDGE_CACHED) app.use(`/api/pulse/${p}`, edgeCache(300, pulseCacheKey(p)));
// A country page costs ~15,000 rows read uncached and there are ~170 of them (a crawler can visit them all), so it is held for an hour.
// A code that is not a country is turned away before it reaches the database or the cache.
app.use('/api/pulse/country/*', async (c, next) => {
  const code = (c.req.path.split('/').pop() ?? '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(code) || !KNOWN_COUNTRY_CODES.has(code)) return c.json({ error: 'Unknown country code.' }, 404);
  return next();
});
app.use('/api/pulse/country/*', edgeCache(3600, countryCacheKey));
// Startup calls made by every page view (and the header ticker): short windows keep a burst of visitors to one read per window.
app.use('/api/pulse/home', edgeCache(60, pulseCacheKey('home')));
for (const p of ['markets', 'news', 'summary', 'tempo']) app.use(`/api/pulse/${p}`, edgeCache(300, pulseCacheKey(p)));
// Sanctions lists reload weekly and this scans all four tables, so it is held at the edge for six hours.
app.use('/api/pulse/sanction-counts', edgeCache(21600, pulseCacheKey('sanction-counts')));
app.use('/api/pulse/data-status', edgeCache(300, pulseCacheKey('data-status')));
app.use('/api/pulse/stats', edgeCache(21600, pulseCacheKey('stats')));
// Weekly country indicators: the key is the validated, sorted country list, so odd query strings cannot mint cache entries.
app.use('/api/pulse/un-alignment', edgeCache(3600, pulseCacheKey('un-alignment')));
app.use('/api/pulse/power', edgeCache(3600, (url) => `${url.origin}${url.pathname}?countries=${normalizeCountries(url.searchParams.get('countries')).join(',')}`));

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
// The daily ceiling across everyone (CLAUDE_DAILY_CAP, default 300 Claude calls per UTC day) is counted where each call is made
// (claimClaudeCall in lib/anthropic.ts), after the case and the request body have been checked, so invalid requests cannot use
// it up and a multi-party screening counts once per call it really makes.
app.use('/api/cases/*', async (c, next) => {
  if (c.req.method === 'POST' && CLAUDE_CALLING_SUFFIXES.some((s) => c.req.path.endsWith(s))) {
    const key = c.req.header('cf-connecting-ip') ?? 'unknown';
    const { success } = await c.env.CLAUDE_RATE_LIMITER.limit({ key });
    if (!success) {
      return c.json({ error: 'Rate limit exceeded. Please wait a moment before trying again.' }, 429);
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
app.use('/api/pulse/sync', limitWrites);

app.route('/api/cases', casesRoute);
app.route('/api/cases', classificationRoute);
app.route('/api/cases', originRoute);
app.route('/api/cases', screeningRoute);
app.route('/api/cases', determinationRoute);
app.route('/api/pulse', pulseRoute);

// Reaches the database (one row), so a monitor sees an outage or a used-up daily quota instead of a constant "ok".
app.get('/api/health', async (c) => {
  try {
    await c.env.DB.prepare('SELECT 1').first();
    c.header('Cache-Control', 'no-store');
    return c.json({ ok: true });
  } catch {
    c.header('Cache-Control', 'no-store');
    return c.json({ ok: false }, 503);
  }
});

// Without this, an uncaught exception (a D1 outage, a quota day, anything
// unexpected) falls through to Hono's default handler: a bare "Internal
// Server Error" text response, which lib/api.ts's request() can't parse as
// JSON and therefore reports as a generic, unhelpful message everywhere it's
// surfaced. This keeps every route's error contract the same ({ error }, as
// json) and logs the real cause to the Worker's own log instead of the client.
app.onError((err, c) => {
  if (err instanceof ClaudeDailyCapError) {
    return c.json({ error: 'The calculator has reached its daily capacity for AI-assisted checks. Please try again tomorrow.' }, 503);
  }
  console.error(err);
  return c.json({ error: 'Something went wrong on our end. Please try again shortly.' }, 500);
});

export default {
  fetch: app.fetch,
  scheduled,
};
