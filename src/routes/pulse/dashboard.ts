import { Hono, type Context } from 'hono';
import type { Env } from '../../types/env.js';
import type { PulseApp } from './util.js';
import { cachedAggregate } from '../../lib/pulse/aggregateCache.js';
import { buildEconomy, type EconomyInputs } from '../../lib/pulse/dashboardEconomy.js';

// The Dashboard is served in sections, each its own request and its own cached answer, so no single invocation has to read everything
// (the Workers Free plan allows 50 database queries per invocation). A section that fails is simply missing; the page shows the rest.
export function dashboardRoute(root: PulseApp): PulseApp {
  const route: PulseApp = new Hono<{ Bindings: Env }>();

  const settle = async <T>(c: Context<{ Bindings: Env }, any>, path: string): Promise<T | null> => {
    try {
      const res = await root.request(path, {}, c.env, c.executionCtx);
      return res.ok ? ((await res.json()) as T) : null;
    } catch {
      return null;
    }
  };

  route.get('/dashboard/economy', async (c) => {
    const build = async () => {
      const [markets, everyday, tic] = await Promise.all([
        settle<EconomyInputs['markets']>(c, '/markets'),
        settle<EconomyInputs['everyday']>(c, '/everyday'),
        settle<EconomyInputs['tic']>(c, '/tic'),
      ]);
      if (!markets && !everyday) throw new Error('no data');
      return buildEconomy({ now: new Date(), markets, everyday, tic });
    };
    try {
      const payload = await cachedAggregate(c.env, 'dash-economy', 30 * 60_000, build);
      c.header('Cache-Control', 'public, max-age=300');
      return c.json(payload);
    } catch {
      return c.json({ error: 'Data is temporarily unavailable.' }, 503);
    }
  });

  return route;
}
