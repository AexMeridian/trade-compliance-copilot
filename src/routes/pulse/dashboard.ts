import { Hono, type Context } from 'hono';
import type { Env } from '../../types/env.js';
import type { PulseApp } from './util.js';
import { cachedAggregate } from '../../lib/pulse/aggregateCache.js';
import { buildEconomy, MAJOR_ECONOMIES, type EconomyInputs } from '../../lib/pulse/dashboardEconomy.js';
import { buildPower, type PowerInputs } from '../../lib/pulse/dashboardPower.js';
import { buildWorld, type WorldInputs } from '../../lib/pulse/dashboardWorld.js';

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
      const [markets, everyday, tic, majors] = await Promise.all([
        settle<EconomyInputs['markets']>(c, '/markets'),
        settle<EconomyInputs['everyday']>(c, '/everyday'),
        settle<EconomyInputs['tic']>(c, '/tic'),
        settle<EconomyInputs['majors']>(c, `/power?countries=${MAJOR_ECONOMIES.join(',')}`),
      ]);
      if (!markets && !everyday) throw new Error('no data');
      return buildEconomy({ now: new Date(), markets, everyday, tic, majors });
    };
    try {
      const payload = await cachedAggregate(c.env, 'dash-economy', 2 * 3600_000, build);
      c.header('Cache-Control', 'public, max-age=300');
      return c.json(payload);
    } catch {
      return c.json({ error: 'Data is temporarily unavailable.' }, 503);
    }
  });

  route.get('/dashboard/power', async (c) => {
    const build = async () => {
      const [summary, tempo, csms, measures, nato, sanctionCounts, wro, opinion, power] = await Promise.all([
        settle<PowerInputs['summary']>(c, '/summary'),
        settle<PowerInputs['tempo']>(c, '/tempo'),
        settle<PowerInputs['csms']>(c, '/csms'),
        settle<PowerInputs['measures']>(c, '/active-measures'),
        settle<PowerInputs['nato']>(c, '/nato-defense'),
        settle<PowerInputs['sanctionCounts']>(c, '/sanction-counts'),
        settle<PowerInputs['wro']>(c, '/wro'),
        settle<PowerInputs['opinion']>(c, '/opinion'),
        settle<PowerInputs['power']>(c, '/power?countries=US,CN'),
      ]);
      if (!summary && !power && !sanctionCounts) throw new Error('no data');
      return buildPower({ now: new Date(), summary, tempo, csms, measures, nato, sanctionCounts, wro, opinion, power });
    };
    try {
      const payload = await cachedAggregate(c.env, 'dash-power', 6 * 3600_000, build);
      c.header('Cache-Control', 'public, max-age=300');
      return c.json(payload);
    } catch {
      return c.json({ error: 'Data is temporarily unavailable.' }, 503);
    }
  });

  route.get('/dashboard/world', async (c) => {
    const build = async () => {
      const [feed, news, advisories, power] = await Promise.all([
        settle<WorldInputs['feed']>(c, '/feed?limit=100'),
        settle<WorldInputs['news']>(c, '/news?limit=60'),
        settle<WorldInputs['advisories']>(c, '/advisories'),
        settle<WorldInputs['power']>(c, '/power?countries=US,CN'),
      ]);
      if (!feed && !news && !advisories && !power) throw new Error('no data');
      return buildWorld({ now: new Date(), feed, news, advisories, power });
    };
    try {
      const payload = await cachedAggregate(c.env, 'dash-world', 60 * 60_000, build);
      c.header('Cache-Control', 'public, max-age=300');
      return c.json(payload);
    } catch {
      return c.json({ error: 'Data is temporarily unavailable.' }, 503);
    }
  });

  return route;
}
