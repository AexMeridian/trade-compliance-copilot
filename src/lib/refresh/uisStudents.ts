// International students, from the UNESCO Institute for Statistics open data API (no key). Two national series: students from
// abroad enrolled in each country, and the net flow ratio (arriving minus leaving, as a share of the country's own enrollment).
import type { Env } from '../../types/env.js';
import { INDICATORS } from '../power/indicators.js';
import type { SeriesByCountry } from '../power/compute.js';
import { changeGate } from './changeGate.js';
import { fetchCountryCodes } from './countryCodes.js';
import { getJson, upsertIndicators } from './indicatorStore.js';
import type { RefreshResult } from './types.js';

const DEFS = INDICATORS.filter((d) => d.provider === 'uis');
const KEEP_POINTS = 12;

interface UisRecord {
  indicatorId: string;
  geoUnit: string;
  year: number;
  value: number | null;
}

export function parseUis(body: unknown, iso3ToIso2: Map<string, string>): Map<string, SeriesByCountry> {
  const records = (body as { records?: unknown }).records;
  if (!Array.isArray(records)) throw new Error('UNESCO statistics response shape changed -- expected { records: [...] }');
  const out = new Map<string, SeriesByCountry>();
  for (const r of records as UisRecord[]) {
    const cc = iso3ToIso2.get(r?.geoUnit);
    if (!cc || typeof r.value !== 'number' || !Number.isFinite(r.value) || !Number.isInteger(r.year)) continue;
    const bySeries = out.get(r.indicatorId) ?? {};
    (bySeries[cc] ??= []).push([r.year, Math.round(r.value * 100) / 100]);
    out.set(r.indicatorId, bySeries);
  }
  for (const series of out.values()) {
    for (const cc of Object.keys(series)) {
      series[cc].sort((a, b) => a[0] - b[0]);
      if (series[cc].length > KEEP_POINTS) series[cc] = series[cc].slice(-KEEP_POINTS);
    }
  }
  return out;
}

export async function refreshUisStudents(env: Env): Promise<RefreshResult> {
  const year = new Date().getUTCFullYear();
  const query = DEFS.map((d) => `indicator=${encodeURIComponent(d.code)}`).join('&');
  const [codes, body] = await Promise.all([
    fetchCountryCodes(),
    getJson(`https://api.uis.unesco.org/api/public/data/indicators?${query}&start=${year - 14}&end=${year}&geoUnitType=NATIONAL`, 45_000),
  ]);
  const parsed = parseUis(body, codes.iso3ToIso2);

  const series = new Map<string, { code: string; data: SeriesByCountry }>();
  const problems: string[] = [];
  for (const d of DEFS) {
    const data = parsed.get(d.code);
    if (!data || Object.keys(data).length < d.minCountries) problems.push(`${d.code}: ${data ? Object.keys(data).length : 0} countries, expected at least ${d.minCountries}`);
    else series.set(d.id, { code: d.code, data });
  }
  if (series.size === 0) throw new Error(`UNESCO statistics returned no usable series. ${problems.join('; ')}`);

  const gate = problems.length ? null : await changeGate(env, 'uis_students', JSON.stringify([...series.entries()]));
  if (gate?.unchanged) return { source: 'uis_students', rows: 0, unchanged: true };
  const rows = await upsertIndicators(env, series);
  await gate?.commit();
  if (problems.length) console.warn(`UNESCO students loaded ${series.size}/${DEFS.length}; skipped: ${problems.join('; ')}`);
  return { source: 'uis_students', rows };
}
