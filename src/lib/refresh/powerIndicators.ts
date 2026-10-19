// Weekly refresh of the Power profile's World Bank indicators (keyless, CC BY 4.0).
// One D1 row per indicator (see migrations/0026), written only when its figures actually changed, so a typical
// week costs a few dozen reads and few or no writes. A series that fails or comes back too thin is skipped and
// reported; the others still load, and the whole run is not marked unchanged until every series arrived.
// The other providers (UN voting, UNESCO, UNHCR, Nobel) have their own small jobs so one outage never blanks the rest.
import type { Env } from '../../types/env.js';
import { INDICATORS, type IndicatorDef } from '../power/indicators.js';
import type { SeriesByCountry } from '../power/compute.js';
import { changeGate } from './changeGate.js';
import type { RefreshResult } from './types.js';
import { fetchCountryCodes, parseCountryCodes } from './countryCodes.js';
import { getJson, upsertIndicators } from './indicatorStore.js';

const API = 'https://api.worldbank.org/v2';
const KEEP_POINTS = 12;
const PARALLEL = 6;
const WORLD_BANK_DEFS = INDICATORS.filter((d) => d.provider === 'worldbank');

/** Real countries from the World Bank country list (aggregates such as "World" or "Euro area" carry region id "NA"). */
export function parseCountryList(body: unknown): Set<string> {
  return parseCountryCodes(body).iso2;
}

/** Turns an Indicators API response into { country: [[year, value], ...] }, oldest first, real countries only, last few years. */
export function parseSeries(body: unknown, countries: Set<string>): SeriesByCountry {
  if (!Array.isArray(body) || !Array.isArray(body[1])) throw new Error('World Bank response shape changed -- expected [meta, rows]');
  const out: SeriesByCountry = {};
  for (const r of body[1] as { country?: { id?: string }; date?: string; value?: number | null }[]) {
    const cc = r?.country?.id;
    const year = Number(r?.date);
    if (!cc || !countries.has(cc) || !Number.isInteger(year) || typeof r.value !== 'number' || !Number.isFinite(r.value)) continue;
    (out[cc] ??= []).push([year, r.value]);
  }
  for (const cc of Object.keys(out)) {
    out[cc].sort((a, b) => a[0] - b[0]);
    if (out[cc].length > KEEP_POINTS) out[cc] = out[cc].slice(-KEEP_POINTS);
  }
  return out;
}

async function fetchSeries(def: IndicatorDef, countries: Set<string>, year: number): Promise<SeriesByCountry> {
  const source = def.wbSource ? `&source=${def.wbSource}` : '';
  const body = await getJson(`${API}/country/all/indicator/${def.code}?format=json&per_page=20000&date=${year - 14}:${year}${source}`);
  const data = parseSeries(body, countries);
  if (Object.keys(data).length < def.minCountries) throw new Error(`${def.code} returned ${Object.keys(data).length} countries, expected at least ${def.minCountries}`);
  return data;
}

export async function refreshPowerIndicators(env: Env): Promise<RefreshResult> {
  const { iso2: countries } = await fetchCountryCodes();

  const year = new Date().getUTCFullYear();
  const fetched = new Map<string, SeriesByCountry>();
  const failures: string[] = [];
  for (let i = 0; i < WORLD_BANK_DEFS.length; i += PARALLEL) {
    const batch = WORLD_BANK_DEFS.slice(i, i + PARALLEL);
    const settled = await Promise.allSettled(batch.map((def) => fetchSeries(def, countries, year)));
    settled.forEach((r, j) => {
      if (r.status === 'fulfilled') fetched.set(batch[j].id, r.value);
      else failures.push(`${batch[j].code}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
    });
  }
  if (fetched.size === 0) throw new Error(`No indicator could be fetched. ${failures.join('; ')}`);

  const gate = failures.length ? null : await changeGate(env, 'power_indicators', JSON.stringify([...fetched.entries()]));
  if (gate?.unchanged) return { source: 'power_indicators', rows: 0, unchanged: true };

  const defs = new Map(WORLD_BANK_DEFS.map((d) => [d.id, d]));
  const rows = await upsertIndicators(env, new Map([...fetched.entries()].map(([id, data]) => [id, { code: defs.get(id)!.code, data }])));
  await gate?.commit();
  if (failures.length) console.warn(`Power indicators loaded ${fetched.size}/${WORLD_BANK_DEFS.length}; skipped: ${failures.join('; ')}`);
  return { source: 'power_indicators', rows };
}
