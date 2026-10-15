// Keeps the country baseline (population, GDP) current from the World Bank Indicators API -- keyless, CC BY 4.0.
// Migration 0022 seeded these once; the World Bank revises them every year, so without this they go stale. Region,
// income group and capital change rarely and stay as seeded. Only countries already in country_snapshot are touched,
// and only rows whose figure actually changed are written, so a typical run costs a handful of writes.
import type { Env } from '../../types/env.js';
import { changeGate } from './changeGate.js';
import type { RefreshResult } from './types.js';
import { USER_AGENT } from './userAgent.js';

const BASE = 'https://api.worldbank.org/v2/country/all/indicator';
const TIMEOUT_MS = 15_000;

export interface Observation {
  country: string; // ISO 3166-1 alpha-2, as the API's country.id
  year: string;
  value: number;
}

/** Latest non-empty value per country from an Indicators API response ([meta, rows]); aggregates (regions) are dropped by the caller. */
export function parseIndicator(body: unknown): Observation[] {
  if (!Array.isArray(body) || !Array.isArray(body[1])) throw new Error('World Bank response shape changed -- expected [meta, rows]');
  const out: Observation[] = [];
  for (const r of body[1] as { country?: { id?: string }; date?: string; value?: number | null }[]) {
    if (r?.country?.id && r.date && typeof r.value === 'number' && Number.isFinite(r.value)) out.push({ country: r.country.id, year: r.date, value: r.value });
  }
  return out;
}

async function fetchIndicator(code: string): Promise<Observation[]> {
  const res = await fetch(`${BASE}/${code}?format=json&per_page=400&mrnev=1`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`World Bank ${code} fetch failed: HTTP ${res.status}`);
  return parseIndicator(await res.json());
}

export async function refreshWorldBank(env: Env): Promise<RefreshResult> {
  const [pop, gdp] = await Promise.all([fetchIndicator('SP.POP.TOTL'), fetchIndicator('NY.GDP.MKTP.CD')]);
  if (pop.length < 100 || gdp.length < 100) throw new Error('World Bank returned too few countries -- aborting without touching country_snapshot');

  const gate = await changeGate(env, 'world_bank', JSON.stringify([pop, gdp]));
  if (gate.unchanged) return { source: 'world_bank', rows: 0, unchanged: true };

  const { results } = await env.DB.prepare('SELECT country_code FROM country_snapshot').all<{ country_code: string }>();
  const known = new Set(results.map((r) => r.country_code));
  const now = new Date().toISOString();
  const statements = [
    ...pop.filter((o) => known.has(o.country)).map((o) =>
      env.DB.prepare(
        `UPDATE country_snapshot SET population = ?2, population_year = ?3, last_updated = ?4
         WHERE country_code = ?1 AND (population IS NOT ?2 OR population_year IS NOT ?3)`
      ).bind(o.country, Math.round(o.value), o.year, now)
    ),
    ...gdp.filter((o) => known.has(o.country)).map((o) =>
      env.DB.prepare(
        `UPDATE country_snapshot SET gdp_usd = ?2, gdp_year = ?3, last_updated = ?4
         WHERE country_code = ?1 AND (gdp_usd IS NOT ?2 OR gdp_year IS NOT ?3)`
      ).bind(o.country, o.value, o.year, now)
    ),
  ];
  for (let i = 0; i < statements.length; i += 90) await env.DB.batch(statements.slice(i, i + 90));
  await gate.commit();
  return { source: 'world_bank', rows: statements.length };
}
