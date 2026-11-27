import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env.js';

/**
 * A second, shared cache layer for whole JSON responses, kept in one pulse_feed_state row per URL.
 *
 * The edge cache (edgeCache.ts) lives in one Cloudflare data center and is lost when an instance recycles, so a page that costs
 * thousands of rows read was still being rebuilt many times a day. This layer is shared by every instance and data center: a hit
 * costs one row read, a miss costs the real query plus one row written. D1's free allowance is 5 million rows read a day, and
 * a single uncached country page reads about 15,000.
 *
 * Only for GET endpoints whose answer depends on nothing but the (normalized) URL and changes on a schedule. Keys come from the
 * same functions as the edge cache, so junk query strings share one row. If the database is unavailable the last stored copy is
 * served (even when stale) instead of an error. A copy larger than MAX_BYTES is not stored.
 */
const MAX_BYTES = 900_000;

export function dbCache(ttlSeconds: number, cacheKeyUrl: (url: URL) => string): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    if (c.req.method !== 'GET' || !c.env?.DB) return next();
    const k = new URL(cacheKeyUrl(new URL(c.req.url)));
    const sourceKey = `resp:${k.pathname}${k.search}`.slice(0, 250);
    const row = await c.env.DB.prepare('SELECT last_success_at, last_note FROM pulse_feed_state WHERE source_key = ?1')
      .bind(sourceKey)
      .first<{ last_success_at: string | null; last_note: string | null }>()
      .catch(() => null);
    const stored = row?.last_note && row.last_success_at ? { at: Date.parse(row.last_success_at), body: row.last_note } : null;
    const serve = (label: string) => {
      c.header('X-Db-Cache', label);
      c.header('Content-Type', 'application/json; charset=UTF-8');
      return c.body(stored!.body, 200);
    };
    if (stored && Date.now() - stored.at < ttlSeconds * 1000) return serve('HIT');

    await next();
    const res = c.res;
    if (res.status === 200 && (res.headers.get('Content-Type') ?? '').includes('json')) {
      const text = await res.clone().text();
      if (text.length <= MAX_BYTES) {
        const write = c.env.DB.prepare(
          `INSERT INTO pulse_feed_state (source_key, last_success_at, last_note) VALUES (?1, ?2, ?3)
           ON CONFLICT(source_key) DO UPDATE SET last_success_at = excluded.last_success_at, last_note = excluded.last_note`
        )
          .bind(sourceKey, new Date().toISOString(), text)
          .run()
          .catch(() => undefined);
        try {
          c.executionCtx.waitUntil(write);
        } catch {
          await write;
        }
      }
      res.headers.set('X-Db-Cache', 'MISS');
    } else if (stored && res.status >= 500) {
      c.res = new Response(stored.body, { status: 200, headers: { 'Content-Type': 'application/json; charset=UTF-8', 'X-Db-Cache': 'STALE' } });
    }
  };
}
