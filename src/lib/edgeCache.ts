import type { MiddlewareHandler } from 'hono';

/**
 * Serves repeat GETs from the Workers Cache API (per data center) for `ttlSeconds`,
 * so a popular country page or timeline costs one database read per window instead of
 * one per visitor. D1 is billed by rows read, and a single uncached country view
 * reads ~30,000 (text scans over the sanctions lists), so this is the cheapest
 * way to keep the site inside its quota as traffic grows.
 *
 * Meant for data that changes on a schedule (cron-refreshed reference tables and the
 * derived timelines). It is also used, with short windows, for the pages' own startup
 * calls (/home, /markets, /news, /summary, /tempo): every page view makes them, and
 * uncached they read tens of thousands of rows each, which is what exhausted the free
 * database quota. The lazy upstream refresh still runs on every miss. (A
 * "bypass the cache" switch was left out on purpose: it would let one client force the expensive
 * read on every request.)
 * Responses carry `X-Edge-Cache: HIT | MISS` so behavior is observable.
 */
// Entries are kept for a day but only treated as fresh for `ttlSeconds`. If the database is unavailable when an entry has gone
// stale (for example the free daily read quota is used up), the last good copy is served instead of an error.
const KEEP_SECONDS = 86_400;

export function edgeCache(ttlSeconds: number, cacheKeyUrl?: (url: URL) => string): MiddlewareHandler {
  return async (c, next) => {
    // The Cache API is absent in some local/test runtimes; never let that break a request.
    const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
    if (c.req.method !== 'GET' || !cache) return next();

    // `cacheKeyUrl` lets an endpoint collapse equivalent URLs (reordered or junk query
    // parameters) into one entry, so a client cannot mint unlimited cache keys.
    const key = new Request(cacheKeyUrl ? cacheKeyUrl(new URL(c.req.url)) : c.req.url, { method: 'GET' });
    const hit = await cache.match(key).catch(() => undefined);
    let stale: Response | undefined;
    if (hit) {
      const cachedAt = Number(hit.headers.get('X-Cached-At') ?? 0);
      const asServed = (label: string) => {
        const res = new Response(hit.body, hit);
        res.headers.set('X-Edge-Cache', label);
        res.headers.set('Cache-Control', `public, max-age=${ttlSeconds}`); // browsers get the normal window, not the one-day keep time
        return res;
      };
      if (!cachedAt || Date.now() - cachedAt < ttlSeconds * 1000) return asServed('HIT');
      stale = asServed('STALE');
    }

    await next();
    if (c.res.status === 200) {
      const copy = c.res.clone();
      copy.headers.set('Cache-Control', `public, max-age=${Math.max(ttlSeconds, KEEP_SECONDS)}`);
      copy.headers.set('X-Cached-At', String(Date.now()));
      c.executionCtx.waitUntil(cache.put(key, copy).catch(() => undefined));
      c.res.headers.set('X-Edge-Cache', 'MISS');
    } else if (stale && c.res.status >= 500) {
      c.res = stale;
    }
  };
}
