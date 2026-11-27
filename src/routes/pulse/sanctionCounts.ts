import { Hono } from 'hono';
import type { Env } from '../../types/env.js';
import type { PulseApp } from './util.js';
import { tallyBySource } from '../../lib/pulse/sanctionCounts.js';
import { cachedAggregate } from '../../lib/pulse/aggregateCache.js';
import { loadListFreshness, type ListFreshness } from '../../lib/listFreshness.js';

// Feeds the Hard Power page's "Sanctioned parties" measure. Reads every row of the four
// sanctions tables once (about 30,000 rows), so it is cached in this isolate and at the edge
// for six hours (src/index.ts) -- the lists are reloaded weekly, so nothing fresher exists.
const TTL_MS = 6 * 60 * 60_000;
export interface SanctionTally {
  /** When this tally was computed, not how current the lists are: see `lists` for that. */
  asOf: string;
  total: number;
  totals: { sdn: number; csl: number; un: number; uk: number };
  /** Every country, not only the top 60, so a country page reads the same number as the Hard Power chart. */
  countries: ReturnType<typeof tallyBySource>;
  /** How current each list is: the date beside every count, so a stale list never reads as a current one. */
  lists: ListFreshness[];
}
let cache: { at: number; value: Promise<SanctionTally> } | null = null;

async function compute(env: Env): Promise<SanctionTally> {
  const texts = async (sql: string, pick: (r: Record<string, string | null>) => string) => {
    const { results } = await env.DB.prepare(sql).all<Record<string, string | null>>().catch(() => ({ results: [] as Record<string, string | null>[] }));
    return results.map(pick);
  };
  const [sdn, csl, un, uk, lists] = await Promise.all([
    texts('SELECT addresses FROM sdn_entries', (r) => r.addresses ?? ''),
    texts('SELECT addresses FROM csl_entries', (r) => r.addresses ?? ''),
    texts('SELECT nationality, addresses FROM un_sanctions_entries', (r) => `${r.nationality ?? ''}; ${r.addresses ?? ''}`),
    texts('SELECT addresses FROM uk_sanctions_entries', (r) => r.addresses ?? ''),
    loadListFreshness(env).catch(() => [] as ListFreshness[]),
  ]);
  // Kept per list: SDN is OFAC sanctions; CSL is the Commerce/State (non-SDN) export-control and related lists; UN and UK are their own lists.
  // A party on several lists is counted once on each, so `total` is listings, not distinct parties.
  const totals = { sdn: sdn.length, csl: csl.length, un: un.length, uk: uk.length };
  return { asOf: new Date().toISOString(), total: totals.sdn + totals.csl + totals.un + totals.uk, totals, countries: tallyBySource({ sdn, csl, un, uk }), lists };
}

/** The one sanctions tally every page reads (Hard Power, country pages, Compare), so the same country never shows two numbers. */
export function getSanctionTally(env: Env): Promise<SanctionTally> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    // Kept in a database row as well: Cloudflare recycles instances constantly, and each cold one re-read all ~30,000 rows.
    const value = cachedAggregate(env, 'sanction-tally', TTL_MS, () => compute(env));
    cache = { at: Date.now(), value };
    value.catch(() => {
      if (cache?.value === value) cache = null;
    });
  }
  return cache.value;
}

export const sanctionCountsRoute: PulseApp = new Hono<{ Bindings: Env }>();

sanctionCountsRoute.get('/sanction-counts', async (c) => {
  const tally = await getSanctionTally(c.env);
  c.header('Cache-Control', 'public, max-age=21600');
  return c.json({ ...tally, countries: tally.countries.slice(0, 60) });
});
