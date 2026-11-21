import { Hono } from 'hono';
import type { Env } from '../../types/env.js';
import type { PulseApp } from './util.js';
import { tallyBySource } from '../../lib/pulse/sanctionCounts.js';

// Feeds the Hard Power page's "Sanctioned parties" measure. Reads every row of the four
// sanctions tables once (about 30,000 rows), so it is cached in this isolate and at the edge
// for six hours (src/index.ts) -- the lists are reloaded weekly, so nothing fresher exists.
const TTL_MS = 6 * 60 * 60_000;
let cache: { at: number; value: Promise<{ asOf: string; total: number; totals: { sdn: number; csl: number; un: number; uk: number }; countries: ReturnType<typeof tallyBySource> }> } | null = null;

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
  // Kept per list: SDN is OFAC sanctions; CSL is the Commerce/State (non-SDN) export-control and related lists; UN and UK are their own lists.
  // A party on several lists is counted once on each, so `total` is listings, not distinct parties.
  const totals = { sdn: sdn.length, csl: csl.length, un: un.length, uk: uk.length };
  return { asOf: new Date().toISOString(), total: totals.sdn + totals.csl + totals.un + totals.uk, totals, countries: tallyBySource({ sdn, csl, un, uk }).slice(0, 60) };
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
