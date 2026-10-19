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
const PARALLEL = 2;
const WORLD_BANK_DEFS = INDICATORS.filter((d) => d.provider === 'worldbank');

/** Real countries from the World Bank country list (aggregates such as "World" or "Euro area" carry region id "NA"). */
export function parseCountryList(body: unknown): Set<string> {
  return parseCountryCodes(body).iso2;
}

/** Turns one row list into { country: [[year, value], ...] }, oldest first, real countries only, last few years. */
function collect(rows: { country?: { id?: string }; date?: string; value?: number | null }[], countries: Set<string>): SeriesByCountry {
  const out: SeriesByCountry = {};
  for (const r of rows) {
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

/** Turns an Indicators API response for ONE indicator into { country: [[year, value], ...] }. */
export function parseSeries(body: unknown, countries: Set<string>): SeriesByCountry {
  if (!Array.isArray(body) || !Array.isArray(body[1])) throw new Error('World Bank response shape changed -- expected [meta, rows]');
  return collect(body[1], countries);
}

/** The same for a response that carries several indicators (`a;b;c` in the URL): one series per World Bank indicator code. */
export function parseSeriesMulti(body: unknown, countries: Set<string>): Map<string, SeriesByCountry> {
  if (!Array.isArray(body) || !Array.isArray(body[1])) {
    const why = (body as { message?: { value?: string }[] }[] | null)?.[0]?.message?.[0]?.value;
    throw new Error(`World Bank response shape changed -- expected [meta, rows]${why ? ` (${why.slice(0, 120)})` : ''}`);
  }
  const meta = body[0] as { pages?: number };
  if (meta?.pages !== undefined && meta.pages > 1) throw new Error('World Bank response needs more than one page; use fewer series per request');
  const byCode = new Map<string, { country?: { id?: string }; date?: string; value?: number | null }[]>();
  for (const r of body[1] as { indicator?: { id?: string }; country?: { id?: string }; date?: string; value?: number | null }[]) {
    const code = r?.indicator?.id;
    if (!code) continue;
    (byCode.get(code) ?? byCode.set(code, []).get(code)!).push(r);
  }
  return new Map([...byCode].map(([code, rows]) => [code, collect(rows, countries)]));
}

// Series per request. Each series is about 4,000 rows over fifteen years and a page holds 32,500, so six always fit in one.
const BATCH = 6;

/** Groups the series into requests: the same World Bank database (the default, or WGI = source 3), BATCH at a time. */
export function planBatches(defs: IndicatorDef[]): IndicatorDef[][] {
  const bySource = new Map<number | undefined, IndicatorDef[]>();
  for (const d of defs) (bySource.get(d.wbSource) ?? bySource.set(d.wbSource, []).get(d.wbSource)!).push(d);
  const out: IndicatorDef[][] = [];
  for (const list of bySource.values()) for (let i = 0; i < list.length; i += BATCH) out.push(list.slice(i, i + BATCH));
  return out;
}

async function fetchBatch(defs: IndicatorDef[], countries: Set<string>, year: number): Promise<Map<string, SeriesByCountry>> {
  // Several indicators in one request need an explicit database: 2 is World Development Indicators, 3 the governance indicators.
  const source = `&source=${defs[0].wbSource ?? 2}`;
  const codes = defs.map((d) => d.code).join(';');
  const body = await getJson(`${API}/country/all/indicator/${codes}?format=json&per_page=32500&date=${year - 14}:${year}${source}`, 60_000);
  const byCode = parseSeriesMulti(body, countries);
  const result = new Map<string, SeriesByCountry>();
  const problems: string[] = [];
  for (const def of defs) {
    const data = byCode.get(def.code) ?? {};
    if (Object.keys(data).length < def.minCountries) problems.push(`${def.code} returned ${Object.keys(data).length} countries, expected at least ${def.minCountries}`);
    else result.set(def.id, data);
  }
  if (problems.length) console.warn(`World Bank series skipped: ${problems.join('; ')}`);
  return result;
}

export async function refreshPowerIndicators(env: Env): Promise<RefreshResult> {
  const { iso2: countries } = await fetchCountryCodes();

  const year = new Date().getUTCFullYear();
  const fetched = new Map<string, SeriesByCountry>();
  const failures: string[] = [];
  const batches = planBatches(WORLD_BANK_DEFS);
  for (let i = 0; i < batches.length; i += PARALLEL) {
    const group = batches.slice(i, i + PARALLEL);
    const settled = await Promise.allSettled(group.map((defs) => fetchBatch(defs, countries, year)));
    settled.forEach((r, j) => {
      if (r.status === 'fulfilled') {
        for (const [id, data] of r.value) fetched.set(id, data);
        // A series that came back too thin was skipped inside the batch; report it so the run is not marked unchanged.
        for (const d of group[j]) if (!r.value.has(d.id)) failures.push(`${d.code}: too few countries`);
      } else failures.push(`${group[j].map((d) => d.code).join(',')}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`);
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
