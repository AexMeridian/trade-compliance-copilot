// Refugees hosted, by country of asylum, from the UNHCR Refugee Data Finder API (no key). One request returns every country and
// year; the per-resident figure is worked out when requested because it needs the World Bank's population.
import type { Env } from '../../types/env.js';
import type { SeriesByCountry } from '../power/compute.js';
import { changeGate } from './changeGate.js';
import { fetchCountryCodes } from './countryCodes.js';
import { getJson, upsertIndicators } from './indicatorStore.js';
import type { RefreshResult } from './types.js';

const KEEP_POINTS = 12;

interface UnhcrItem {
  year: number;
  coa_iso?: string;
  refugees?: number | string;
}

export function parseUnhcr(body: unknown, iso3ToIso2: Map<string, string>): SeriesByCountry {
  const items = (body as { items?: unknown }).items;
  if (!Array.isArray(items)) throw new Error('UNHCR response shape changed -- expected { items: [...] }');
  const out: SeriesByCountry = {};
  for (const it of items as UnhcrItem[]) {
    const cc = it?.coa_iso ? iso3ToIso2.get(it.coa_iso) : undefined;
    const value = Number(it?.refugees);
    if (!cc || !Number.isInteger(it.year) || !Number.isFinite(value)) continue;
    const list = (out[cc] ??= []);
    const existing = list.find((p) => p[0] === it.year);
    if (existing) existing[1] += value; // a country can appear more than once in a year
    else list.push([it.year, value]);
  }
  for (const cc of Object.keys(out)) {
    out[cc].sort((a, b) => a[0] - b[0]);
    if (out[cc].length > KEEP_POINTS) out[cc] = out[cc].slice(-KEEP_POINTS);
  }
  return out;
}

export async function refreshUnhcr(env: Env): Promise<RefreshResult> {
  const year = new Date().getUTCFullYear();
  const [codes, body] = await Promise.all([
    fetchCountryCodes(),
    getJson(`https://api.unhcr.org/population/v1/population/?limit=10000&yearFrom=${year - 12}&yearTo=${year}&coa_all=true`, 45_000),
  ]);
  const data = parseUnhcr(body, codes.iso3ToIso2);
  if (Object.keys(data).length < 100) throw new Error(`UNHCR returned ${Object.keys(data).length} countries, expected at least 100`);

  const gate = await changeGate(env, 'unhcr', JSON.stringify(data));
  if (gate.unchanged) return { source: 'unhcr', rows: 0, unchanged: true };
  const rows = await upsertIndicators(env, new Map([['refugees_hosted', { code: 'refugees', data }]]));
  await gate.commit();
  return { source: 'unhcr', rows };
}
