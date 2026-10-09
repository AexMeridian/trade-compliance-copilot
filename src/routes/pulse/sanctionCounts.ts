import { Hono } from 'hono';
import type { Env } from '../../types/env.js';
import type { PulseApp } from './util.js';
import { tallyCountries } from '../../lib/pulse/sanctionCounts.js';

// Feeds the U.S. abroad page's "Sanctioned parties" measure. Reads every row of the four
// sanctions tables once (about 30,000 rows), so it is cached in this isolate and at the edge
// for six hours (src/index.ts) -- the lists are reloaded weekly, so nothing fresher exists.
const TTL_MS = 6 * 60 * 60_000;
let cache: { at: number; value: Promise<{ asOf: string; total: number; countries: { country: string; count: number }[] }> } | null = null;

async function compute(env: Env) {
  const texts = async (sql: string, pick: (r: Record<string, string | null>) => string) => {
    const { results } = await env.DB.prepare(sql).all<Record<string, string | null>>().catch(() => ({ results: [] as Record<string, string | null>[] }));
    return results.map(pick);
  };
  const [sdn, csl, un, uk] = await Promise.all([
    texts('SELECT addresses FROM sdn_entries', (r) => r.addresses ?? ''),
    texts('SELECT addresses FROM csl_entries', (r) => r.addresses ?? ''),
    texts('SELECT nationality, addresses FROM un_sanctions_entries', (r) => `${r.nationality ?? ''}; ${r.addresses ?? ''}`),
    texts('SELECT addresses FROM uk_sanctions_entries', (r) => r.addresses ?? ''),
  ]);
  const all = [...sdn, ...csl, ...un, ...uk];
  return { asOf: new Date().toISOString(), total: all.length, countries: tallyCountries(all).slice(0, 60) };
}

export const sanctionCountsRoute: PulseApp = new Hono<{ Bindings: Env }>();

sanctionCountsRoute.get('/sanction-counts', async (c) => {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const value = compute(c.env);
    cache = { at: Date.now(), value };
    value.catch(() => {
      if (cache?.value === value) cache = null;
    });
  }
  c.header('Cache-Control', 'public, max-age=21600');
  return c.json(await cache.value);
});
