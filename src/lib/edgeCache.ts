import type { MiddlewareHandler } from 'hono';

/**
 * Serves repeat GETs from the Workers Cache API (per data center) for `ttlSeconds`,
 * so a popular country page or timeline costs one database read per window instead of
 * one per visitor. D1 is billed by rows read, and a single uncached country view
 * reads ~30,000 (text scans over the sanctions lists), so this is the cheapest
 * way to keep the site inside its quota as traffic grows.
 *
 * Only for data that changes on a schedule (cron-refreshed reference tables and
 * the derived timelines), never for endpoints that lazily refresh upstream sources
 * or that a user action must make fresh (/home, /feed, /summary, /news, /markets).
 * Responses carry `X-Edge-Cache: HIT | MISS` so behavior is observable.
 */
export function edgeCache(ttlSeconds: number): MiddlewareHandler {
  return async (c, next) => {
    // The Cache API is absent in some local/test runtimes; never let that break a request.
    const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default;
    if (c.req.method !== 'GET' || !cache) return next();

    const key = new Request(c.req.url, { method: 'GET' });
    const hit = await cache.match(key).catch(() => undefined);
    if (hit) {
      const res = new Response(hit.body, hit);
      res.headers.set('X-Edge-Cache', 'HIT');
      return res;
    }

    await next();
    if (c.res.status === 200) {
      const copy = c.res.clone();
      copy.headers.set('Cache-Control', `public, max-age=${ttlSeconds}`);
      c.executionCtx.waitUntil(cache.put(key, copy).catch(() => undefined));
      c.res.headers.set('X-Edge-Cache', 'MISS');
    }
  };
}
