import { Hono } from 'hono';
import type { Env } from '../../types/env.js';
import type { PulseApp } from './util.js';
import { buildPowerView, deriveRows, normalizeCountries, parseStored, type SeriesByCountry } from '../../lib/power/compute.js';
import { DIMENSIONS } from '../../lib/power/indicators.js';

// Country indicators for the Power profile: one small read (about 25 rows of indicator_snapshot, weekly data), held in this
// isolate for an hour and at the edge for an hour (src/index.ts, keyed on the normalized country list so junk or reordered
// parameters share one entry). Ranks and distributions are computed here with plain arithmetic -- there is no score.
const TTL_MS = 60 * 60_000;
type Loaded = { asOf: string | null; stored: number; rows: Map<string, SeriesByCountry> };
let cache: { at: number; value: Promise<Loaded> } | null = null;

async function load(env: Env): Promise<Loaded> {
  const { results } = await env.DB.prepare('SELECT indicator, fetched_at, data_json FROM indicator_snapshot').all<{ indicator: string; fetched_at: string; data_json: string }>();
  const rows = deriveRows(new Map(results.map((r) => [r.indicator, parseStored(r.data_json)])));
  const asOf = results.reduce<string | null>((max, r) => (!max || r.fetched_at > max ? r.fetched_at : max), null);
  return { asOf, stored: results.length, rows };
}

export const powerRoute: PulseApp = new Hono<{ Bindings: Env }>();

export async function loaded(c: { env: Env }): Promise<Loaded> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const value = load(c.env);
    cache = { at: Date.now(), value };
    value.catch(() => {
      if (cache?.value === value) cache = null;
    });
  }
  return cache.value;
}

// Every country's General Assembly position by year, for the alignment globe: arrays line up with `years`, null where a country
// had no vote that year. About 60 KB, from the same cached read as /power.
powerRoute.get('/un-alignment', async (c) => {
  const { asOf, rows } = await loaded(c);
  const positions = rows.get('un_ideal_point') ?? {};
  const years = [...new Set(Object.values(positions).flatMap((s) => s.map((p) => p[0])))].sort((a, b) => a - b);
  const byCountry: Record<string, (number | null)[]> = {};
  for (const [cc, s] of Object.entries(positions)) {
    const m = new Map(s);
    byCountry[cc] = years.map((y) => m.get(y) ?? null);
  }
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({ asOf, years, positions: byCountry });
});

powerRoute.get('/power', async (c) => {
  const countries = normalizeCountries(c.req.query('countries'));
  const { asOf, stored, rows } = await loaded(c);
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({
    asOf,
    loaded: stored > 0,
    countries,
    dimensions: DIMENSIONS,
    indicators: buildPowerView(rows, countries),
  });
});
