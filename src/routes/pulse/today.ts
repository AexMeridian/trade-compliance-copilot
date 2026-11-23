import { Hono } from 'hono';
import type { Env } from '../../types/env.js';
import type { PulseApp } from './util.js';
import { buildToday, type TodayInputs } from '../../lib/pulse/briefing.js';
import { cachedAggregate } from '../../lib/pulse/aggregateCache.js';
import { fetchWorldEvents } from '../../lib/pulse/worldEvents.js';

// GET /api/pulse/today: the plain-English dashboard in one response. It composes the same handlers the other pages use (so every rule
// lives in one place) and keeps the answer in one stored row for a short while, so a page view normally reads one row, not dozens of
// queries (the Workers Free plan allows 50 per invocation). A source that fails drops its own card; only an empty result is an error.
export function todayRoute(root: PulseApp): PulseApp {
  const route: PulseApp = new Hono<{ Bindings: Env }>();

  route.get('/today', async (c) => {
    const build = async () => {
      const settle = async <T>(path: string): Promise<T | null> => {
        try {
          const res = await root.request(path, {}, c.env, c.executionCtx);
          return res.ok ? ((await res.json()) as T) : null;
        } catch {
          return null;
        }
      };
      const [feed, news, summary, markets, everyday, advisories, listChanges, events] = await Promise.all([
        settle<TodayInputs['feed']>('/feed?limit=100'),
        settle<TodayInputs['news']>('/news?limit=60'),
        settle<TodayInputs['summary']>('/summary'),
        settle<TodayInputs['markets']>('/markets'),
        settle<TodayInputs['everyday']>('/everyday'),
        settle<TodayInputs['advisories']>('/advisories'),
        settle<TodayInputs['listChanges']>('/list-changes'),
        fetchWorldEvents().catch(() => null),
      ]);
      if (!feed && !news && !markets && !everyday) throw new Error('no data');
      return buildToday({ now: new Date(), feed, news, summary, markets, everyday, advisories, listChanges, events });
    };
    try {
      const payload = await cachedAggregate(c.env, 'today', 20 * 60_000, build);
      c.header('Cache-Control', 'public, max-age=300');
      return c.json(payload);
    } catch {
      return c.json({ error: 'Data is temporarily unavailable.' }, 503);
    }
  });

  return route;
}
