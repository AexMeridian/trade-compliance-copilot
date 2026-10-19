// Humanitarian funding given, by donor government, from OCHA's Financial Tracking Service public API (no key). The API returns one
// report per calendar year grouped by country, and "source" countries are the donors. The current year is left out because it is
// still filling in and would read as a collapse in giving. OCHA publishes the same data on the Humanitarian Data Exchange under
// CC BY-IGO (source: OCHA Financial Tracking Service).
import type { Env } from '../../types/env.js';
import type { SeriesByCountry } from '../power/compute.js';
import { changeGate } from './changeGate.js';
import { codeForName, fetchCountryCodes, type CountryCodes } from './countryCodes.js';
import { getJson, upsertIndicators } from './indicatorStore.js';
import type { RefreshResult } from './types.js';

const API = 'https://api.hpc.tools/v1/public/fts/flow';
const YEARS_BACK = 8;
const PARALLEL = 4;

interface FtsObject {
  direction?: string;
  singleFundingObjects?: { name?: string; totalFunding?: number }[];
}

/** One year's donor totals by country code. Names that are not countries ("Not specified", institutions) are returned in `unmapped`. */
export function parseFtsYear(body: unknown, codes: CountryCodes): { totals: Map<string, number>; unmapped: string[] } {
  const objects = (body as { data?: { report1?: { fundingTotals?: { objects?: FtsObject[] } } } })?.data?.report1?.fundingTotals?.objects;
  if (!Array.isArray(objects)) throw new Error('OCHA funding response shape changed -- expected data.report1.fundingTotals.objects');
  const totals = new Map<string, number>();
  const unmapped: string[] = [];
  for (const o of objects) {
    if (o?.direction !== 'source') continue;
    for (const d of o.singleFundingObjects ?? []) {
      if (!d?.name || typeof d.totalFunding !== 'number' || !Number.isFinite(d.totalFunding) || d.totalFunding <= 0) continue;
      const cc = codeForName(codes, d.name);
      if (cc) totals.set(cc, (totals.get(cc) ?? 0) + d.totalFunding);
      else unmapped.push(d.name);
    }
  }
  return { totals, unmapped };
}

export function seriesFromYears(byYear: Map<number, Map<string, number>>): SeriesByCountry {
  const out: SeriesByCountry = {};
  for (const [year, totals] of [...byYear].sort((a, b) => a[0] - b[0])) {
    for (const [cc, usd] of totals) (out[cc] ??= []).push([year, Math.round(usd)]);
  }
  return out;
}

export async function refreshFts(env: Env): Promise<RefreshResult> {
  const codes = await fetchCountryCodes();
  const last = new Date().getUTCFullYear() - 1;
  const years = Array.from({ length: YEARS_BACK }, (_, i) => last - i);
  const byYear = new Map<number, Map<string, number>>();
  const failures: string[] = [];
  const unmapped = new Set<string>();
  for (let i = 0; i < years.length; i += PARALLEL) {
    const batch = years.slice(i, i + PARALLEL);
    const settled = await Promise.allSettled(batch.map(async (y) => parseFtsYear(await getJson(`${API}?year=${y}&groupby=country`, 45_000), codes)));
    settled.forEach((r, j) => {
      if (r.status === 'fulfilled') {
        byYear.set(batch[j], r.value.totals);
        r.value.unmapped.forEach((n) => unmapped.add(n));
      } else failures.push(`${batch[j]}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
    });
  }
  const latest = byYear.get(last);
  if (!latest || latest.size < 15) throw new Error(`OCHA funding for ${last} returned ${latest?.size ?? 0} donor countries, expected at least 15. ${failures.join('; ')}`);
  if (unmapped.size) console.warn(`OCHA donors not matched to a country: ${[...unmapped].sort().join(', ')}`);

  const data = seriesFromYears(byYear);
  const gate = failures.length ? null : await changeGate(env, 'fts', JSON.stringify(data));
  if (gate?.unchanged) return { source: 'fts', rows: 0, unchanged: true };
  const rows = await upsertIndicators(env, new Map([['humanitarian_given', { code: 'fts_donors', data }]]));
  await gate?.commit();
  if (failures.length) console.warn(`OCHA funding loaded ${byYear.size}/${years.length} years; skipped: ${failures.join('; ')}`);
  return { source: 'fts', rows };
}
