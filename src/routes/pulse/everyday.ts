import { Hono } from 'hono';
import type { Env } from '../../types/env.js';
import type { PulseApp } from './util.js';
import { EVERYDAY_SERIES } from '../../lib/pulse/macro.js';
import { ADVISORY_KEY, refreshCustomsDuties, refreshTravelAdvisories, type TravelAdvisory } from '../../lib/pulse/everyday.js';
import { refreshMacro } from '../../lib/pulse/macro.js';
import { refreshIfStale } from '../../lib/pulse/refreshLazy.js';

// Like the Markets panel: a visit that finds a source past its age refreshes it in the background, so a new series fills in without
// waiting for the next daily job. One claim per source per window, so concurrent visits never repeat the fetch.
const HOURS = 3_600_000;
function lazyRefresh(c: { env: Env; executionCtx: { waitUntil: (p: Promise<unknown>) => void } }, jobs: Promise<unknown>[]) {
  try {
    c.executionCtx.waitUntil(Promise.allSettled(jobs));
  } catch {
    /* no execution context (tests): skip */
  }
}
import { FX_QUOTES } from '../../lib/pulse/markets.js';
import { getApplicableOverlays, getRateBearingHtsLine, searchHts } from '../../lib/db.js';
import { buildDutyStack } from '../../lib/dutyStack.js';
import { KNOWN_COUNTRY_CODES } from '../../lib/pulse/country.js';
import { trailingStats, trailingWindow, CENSUS_SOURCE_URL, type TradePoint } from '../../lib/pulse/census.js';
import { USER_AGENT } from '../../lib/refresh/userAgent.js';
import { loadAdcvdMatches } from '../../lib/adcvd.js';
import { CHOKEPOINTS, GSCPI_ID, GSCPI_META, GSCPI_PAGE, PORTWATCH_PAGE, pwId, refreshFreight } from '../../lib/pulse/freight.js';
import { parseWbIndicator, REMITTANCE_INBOUND_URL, REMITTANCE_US_OUTBOUND_URL, REMITTANCE_SOURCE, REMITTANCE_SOURCE_URL } from '../../lib/pulse/remittance.js';

// Endpoints behind the pages ordinary visitors asked for (prices, jobs, customs receipts, travel advisories, currency history) and the
// professionals' free tariff lookup. All read stored official data or one official API; none calls a model.
export const everydayRoute: PulseApp = new Hono<{ Bindings: Env }>();

type Point = [string, number];
const yoy = (pts: Point[]): number | null => {
  const last = pts.at(-1);
  if (!last) return null;
  const target = `${Number(last[0].slice(0, 4)) - 1}${last[0].slice(4)}`;
  const prev = pts.find((p) => p[0] === target);
  return prev && prev[1] !== 0 ? Math.round(((last[1] - prev[1]) / prev[1]) * 1000) / 10 : null;
};

// Tariff dates to mark on the charts, from the site's own hand-verified overlay table.
type TariffDate = { program: string; since: string; rate: number | null; legal_basis: string; source_url: string };
function loadTariffDates(env: Env): Promise<TariffDate[]> {
  return env.DB.prepare(
    `SELECT program, MIN(effective_date) AS since, MAX(rate_pct) AS rate, MIN(legal_basis) AS legal_basis, MIN(source_url) AS source_url
     FROM tariff_overlays WHERE program IN ('sec232_steel','sec232_aluminum','sec232_copper','sec232_autos','sec232_auto_parts','sec301_forced_labor')
       AND (expiration_date IS NULL OR expiration_date >= date('now')) GROUP BY program`
  )
    .all<TariffDate>()
    .then((r) => r.results)
    .catch(() => []);
}

everydayRoute.get('/everyday', async (c) => {
  lazyRefresh(c, [
    refreshIfStale(c.env, 'customs', 12 * HOURS, () => refreshCustomsDuties(c.env)),
    refreshIfStale(c.env, 'macro', 12 * HOURS, () => refreshMacro(c.env)),
  ]);
  const ids = [...EVERYDAY_SERIES.map((s) => s.id), 'BLS:CPI', 'BLS:IMPORT_PX', 'TREAS:CUSTOMS_GROSS', 'TREAS:CUSTOMS_NET'];
  const [{ results }, meta, overlays] = await Promise.all([
    c.env.DB.prepare(`SELECT series_id, obs_date, value FROM market_series WHERE series_id IN (${ids.map((_, i) => `?${i + 1}`).join(',')}) ORDER BY series_id, obs_date`)
      .bind(...ids)
      .all<{ series_id: string; obs_date: string; value: number }>()
      .catch(() => ({ results: [] as { series_id: string; obs_date: string; value: number }[] })),
    c.env.DB.prepare(`SELECT series_id, label, unit, source, source_url FROM market_series_meta WHERE series_id IN (${ids.map((_, i) => `?${i + 1}`).join(',')})`)
      .bind(...ids)
      .all<{ series_id: string; label: string; unit: string; source: string; source_url: string }>()
      .then((r) => new Map(r.results.map((m) => [m.series_id, m])))
      .catch(() => new Map()),
    loadTariffDates(c.env),
  ]);
  const byId = new Map<string, Point[]>();
  for (const r of results) {
    const list = byId.get(r.series_id) ?? [];
    list.push([r.obs_date, r.value]);
    byId.set(r.series_id, list);
  }
  const series = (id: string, label?: string, group?: string) => {
    const pts = byId.get(id) ?? [];
    const m = meta.get(id);
    return {
      id,
      label: label ?? m?.label ?? id,
      group: group ?? null,
      unit: m?.unit ?? null,
      source: m?.source ?? null,
      sourceUrl: m?.source_url ?? null,
      latest: pts.at(-1) ?? null,
      yoyPct: yoy(pts),
      points: pts,
    };
  };
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({
    prices: [series('BLS:CPI', 'All consumer prices'), ...EVERYDAY_SERIES.filter((s) => s.group === 'prices').map((s) => series(s.id, s.label, 'prices')), series('BLS:IMPORT_PX', 'Prices of imported goods')],
    jobs: EVERYDAY_SERIES.filter((s) => s.group === 'jobs').map((s) => series(s.id, s.label, 'jobs')),
    customs: { gross: series('TREAS:CUSTOMS_GROSS'), net: series('TREAS:CUSTOMS_NET') },
    tariffDates: overlays,
  });
});

everydayRoute.get('/advisories', async (c) => {
  lazyRefresh(c, [refreshIfStale(c.env, 'advisories', 12 * HOURS, () => refreshTravelAdvisories(c.env))]);
  const row = await c.env.DB.prepare(`SELECT last_success_at, last_note FROM pulse_feed_state WHERE source_key = ?1`)
    .bind(ADVISORY_KEY)
    .first<{ last_success_at: string | null; last_note: string | null }>()
    .catch(() => null);
  let items: TravelAdvisory[] = [];
  try {
    items = row?.last_note ? (JSON.parse(row.last_note) as TravelAdvisory[]) : [];
  } catch {
    items = [];
  }
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({ asOf: row?.last_success_at ?? null, source: 'U.S. Department of State, travel.state.gov', items });
});

// One currency's last year against the dollar, straight from the ECB reference rates (via Frankfurter), cached at the edge. Read on
// request instead of stored, so the daily job's database budget is untouched.
const FX_HISTORY_TTL = 6 * 3600;
everydayRoute.get('/fx-history', async (c) => {
  const code = (c.req.query('code') ?? '').toUpperCase();
  if (!(FX_QUOTES as readonly string[]).includes(code)) return c.json({ error: 'Unknown currency.' }, 400);
  const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
  const key = new Request(`https://cache.aexterminal.internal/fx-history/${code}`);
  const hit = await cache?.match(key);
  // A Response from the cache has immutable headers, and the security-header middleware sets headers on every response: return a copy.
  if (hit) return new Response(hit.body, hit);
  const from = new Date(Date.now() - 372 * 86_400_000).toISOString().slice(0, 10);
  const res = await fetch(`https://api.frankfurter.dev/v1/${from}..?base=USD&symbols=${code}`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) return c.json({ error: 'Currency history is not available right now.' }, 502);
  const json = (await res.json()) as { rates?: Record<string, Record<string, number>> };
  const points = Object.entries(json.rates ?? {})
    .map(([d, r]) => [d, r[code]] as [string, number])
    .filter(([, v]) => Number.isFinite(v))
    .sort((a, b) => a[0].localeCompare(b[0]));
  const out = new Response(JSON.stringify({ code, source: 'European Central Bank reference rates, via frankfurter.dev', unit: `${code} per 1 U.S. dollar`, points }), {
    headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${FX_HISTORY_TTL}` },
  });
  if (cache) c.executionCtx.waitUntil(cache.put(key, out.clone()));
  return out;
});

// --- Free tariff lookup: every modeled duty layer for one HTS code and one origin, with no model call ---
everydayRoute.get('/hts-search', async (c) => {
  const q = (c.req.query('q') ?? '').trim().slice(0, 80);
  if (q.length < 2) return c.json({ results: [] });
  const rows = await searchHts(c.env, q, 25).catch(() => []);
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({
    results: rows
      .filter((r) => r.htsno)
      .slice(0, 25)
      .map((r) => ({ htsno: r.htsno, description: r.description.replace(/<\/?[a-z]+>/gi, ''), general_rate: r.general_rate, chapter: r.chapter })),
  });
});

everydayRoute.get('/duty', async (c) => {
  const hts = (c.req.query('hts') ?? '').replace(/[^0-9.]/g, '').slice(0, 13);
  const country = (c.req.query('country') ?? '').toUpperCase();
  if (!/^\d{4}(\.\d{2}){0,3}$/.test(hts) && !/^\d{4,10}$/.test(hts)) return c.json({ error: 'Enter an HTS code such as 7323.93.00 or 7323.93.' }, 400);
  if (!KNOWN_COUNTRY_CODES.has(country) || country === 'US') return c.json({ error: 'Choose the country the goods come from.' }, 400);
  const dotted = hts.includes('.') ? hts : hts.replace(/^(\d{4})(\d{2})?(\d{2})?(\d{2})?$/, (_m, a, b, d, e) => [a, b, d, e].filter(Boolean).join('.'));
  let line = await getRateBearingHtsLine(c.env, dotted).catch(() => null);
  if (!line || !line.general_rate.trim()) {
    // A short code (a heading such as 7323.93) has no rate of its own: offer the rate-bearing lines under it, or use the only one.
    const { results: choices } = await c.env.DB.prepare(
      `SELECT htsno, description, general_rate FROM hts_lines WHERE htsno LIKE ?1 AND TRIM(general_rate) != '' ORDER BY htsno LIMIT 40`
    )
      .bind(`${dotted}%`)
      .all<{ htsno: string; description: string; general_rate: string }>()
      .catch(() => ({ results: [] as { htsno: string; description: string; general_rate: string }[] }));
    if (choices.length === 1) line = await getRateBearingHtsLine(c.env, choices[0].htsno).catch(() => null);
    else if (choices.length > 1) {
      c.header('Cache-Control', 'public, max-age=3600');
      return c.json({ choices: choices.map((r) => ({ htsno: r.htsno, description: r.description.replace(/<\/?[a-z]+>/gi, ''), general_rate: r.general_rate })) });
    }
  }
  if (!line) return c.json({ error: `HTS ${dotted} is not a line in the loaded schedule. Check the code, or search by words.` }, 404);
  const overlays = await getApplicableOverlays(c.env, line.htsno, country).catch(() => []);
  const result = buildDutyStack(line, country, null, overlays);
  const adcvd = await loadAdcvdMatches(c.env, line.htsno, country, line.description.replace(/<\/?[a-z]+>/gi, ''));
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({
    hts: line.htsno,
    description: line.description.replace(/<\/?[a-z]+>/gi, ''),
    country,
    generalRate: line.general_rate,
    revision: line.revision,
    totalPct: result.totalPct,
    lines: result.lines,
    adcvd,
    note:
      'Estimate from the tariff layers this site models (HTS rate, Section 232, Section 301 forced-labor, Section 338, and for goods of China the Section 301 Lists 1-4A where the line is covered). Antidumping and countervailing duties, China exclusions granted after HTS Revision 23, fees, freight and USMCA treatment are not included. Not a ruling: confirm with a licensed customs broker.',
  });
});

// Antidumping and countervailing duty orders that may apply (the calculator report asks with the HTS code and origin it already has).
everydayRoute.get('/adcvd', async (c) => {
  const hts = (c.req.query('hts') ?? '').replace(/[^0-9.]/g, '').slice(0, 13);
  const country = (c.req.query('country') ?? '').toUpperCase();
  if (!/^\d{4}[0-9.]*$/.test(hts) || !/^[A-Z]{2}$/.test(country)) return c.json({ error: 'Give an HTS code and a two-letter country code.' }, 400);
  const line = await getRateBearingHtsLine(c.env, hts).catch(() => null);
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json(await loadAdcvdMatches(c.env, hts, country, line?.description.replace(/<\/?[a-z]+>/gi, '') ?? ''));
});

// --- Freight and supply-chain indicators: NY Fed GSCPI (monthly) and IMF PortWatch chokepoint transits (weekly averages) ---
everydayRoute.get('/freight', async (c) => {
  lazyRefresh(c, [refreshIfStale(c.env, 'freight', 24 * HOURS, () => refreshFreight(c.env))]);
  const ids = [GSCPI_ID, ...CHOKEPOINTS.map((k) => pwId(k.portid))];
  const { results } = await c.env.DB.prepare(`SELECT series_id, obs_date, value FROM market_series WHERE series_id IN (${ids.map((_, i) => `?${i + 1}`).join(',')}) ORDER BY series_id, obs_date`)
    .bind(...ids)
    .all<{ series_id: string; obs_date: string; value: number }>()
    .catch(() => ({ results: [] as { series_id: string; obs_date: string; value: number }[] }));
  const by = new Map<string, [string, number][]>();
  for (const r of results) by.set(r.series_id, [...(by.get(r.series_id) ?? []), [r.obs_date, r.value]]);
  const gs = by.get(GSCPI_ID) ?? [];
  const weekEnd = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 6 * 86_400_000).toISOString().slice(0, 10);
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({
    gscpi: { label: GSCPI_META.label, unit: GSCPI_META.unit, source: GSCPI_META.source, sourceUrl: GSCPI_PAGE, asOf: gs.at(-1)?.[0].slice(0, 7) ?? null, points: gs },
    chokepoints: CHOKEPOINTS.map((k) => {
      const pts = by.get(pwId(k.portid)) ?? [];
      return { id: k.portid, name: k.name, points: pts, asOf: pts.length ? weekEnd(pts[pts.length - 1][0]) : null };
    }),
    chokepointSource: 'IMF PortWatch (ship-tracking estimates of daily vessel transits; weekly averages of complete Monday-to-Sunday weeks)',
    chokepointSourceUrl: PORTWATCH_PAGE,
    note: 'The index is in standard deviations from its long-run average: 0 is normal, above 0 means more strain on global shipping and supply than usual. Recent months are revised as data arrive. Transit counts are estimates from ship-tracking signals, not official customs figures.',
  });
});

// --- Census trade by partner and foreign-born population (key-gated; see src/lib/pulse/census.ts) ---
// Every endpoint answers 200 with a status, never an error, so a page can say "not available yet" without a console error.
const CENSUS_SOURCE = 'U.S. Census Bureau, international trade (imports for consumption, calculated duties, exports), monthly';
type CensusRow = { ym: string; cty_code: string; cty_name: string; iso2: string | null; imports: number | null; duties: number | null; exports: number | null };
const toPoint = (r: CensusRow): TradePoint => ({ ym: r.ym, imports: r.imports, duties: r.duties, exports: r.exports });
const pt = (r: TradePoint): [string, number | null, number | null, number | null] => [r.ym, r.imports, r.duties, r.exports];
const addNullable = (a: number | null, b: number | null) => (b === null ? a : (a ?? 0) + b);

/** Several Census partner codes can map to one country; their rows add up month by month. */
function mergeByMonth(rows: CensusRow[]): TradePoint[] {
  const byMonth = new Map<string, TradePoint>();
  for (const r of rows) {
    const cur = byMonth.get(r.ym) ?? { ym: r.ym, imports: null, duties: null, exports: null };
    byMonth.set(r.ym, { ym: r.ym, imports: addNullable(cur.imports, r.imports), duties: addNullable(cur.duties, r.duties), exports: addNullable(cur.exports, r.exports) });
  }
  return [...byMonth.values()].sort((a, b) => a.ym.localeCompare(b.ym));
}

async function censusStatus(env: Env, key: string, hasData: boolean): Promise<{ status: 'ok' | 'needs_key' | 'not_loaded'; updatedAt: string | null }> {
  const row = await env.DB.prepare(`SELECT last_success_at, last_note FROM pulse_feed_state WHERE source_key = ?1`)
    .bind(key)
    .first<{ last_success_at: string | null; last_note: string | null }>()
    .catch(() => null);
  if (hasData) return { status: 'ok', updatedAt: row?.last_success_at ?? null };
  return { status: row?.last_note?.startsWith('Skipped: needs CENSUS_API_KEY') ? 'needs_key' : 'not_loaded', updatedAt: null };
}

async function loadAllPartners(env: Env): Promise<TradePoint[]> {
  const { results } = await env.DB.prepare(`SELECT ym, cty_code, cty_name, iso2, imports, duties, exports FROM census_trade WHERE cty_code = 'ALL' ORDER BY ym`)
    .all<CensusRow>()
    .catch(() => ({ results: [] as CensusRow[] }));
  return results.map(toPoint);
}

// The effective tariff rate: Census-calculated duties divided by imports for consumption, in total and for the largest partners.
everydayRoute.get('/census/tariff-rate', async (c) => {
  const all = await loadAllPartners(c.env);
  const st = await censusStatus(c.env, 'census_trade', all.length > 0);
  c.header('Cache-Control', 'public, max-age=3600');
  const tariffDates = await loadTariffDates(c.env);
  if (all.length === 0) return c.json({ ...st, source: CENSUS_SOURCE, sourceUrl: CENSUS_SOURCE_URL, asOf: null, total: [], partners: [], tariffDates });
  const window = trailingWindow(all);
  const asOf = all.filter((r) => r.imports !== null).at(-1)?.ym ?? null;
  const cutoff = asOf ? new Date(Date.UTC(Number(asOf.slice(0, 4)), Number(asOf.slice(5, 7)) - 12, 1)).toISOString().slice(0, 7) : '0000-00';
  const top = await c.env.DB.prepare(
    `SELECT cty_code, MIN(cty_name) AS cty_name, MIN(iso2) AS iso2, SUM(imports) AS imports FROM census_trade
     WHERE cty_code != 'ALL' AND ym >= ?1 GROUP BY cty_code ORDER BY imports DESC LIMIT 8`
  )
    .bind(cutoff)
    .all<{ cty_code: string; cty_name: string; iso2: string | null; imports: number }>()
    .catch(() => ({ results: [] as { cty_code: string; cty_name: string; iso2: string | null; imports: number }[] }));
  const codes = top.results.map((r) => r.cty_code);
  const { results: partnerRows } = codes.length
    ? await c.env.DB.prepare(`SELECT ym, cty_code, cty_name, iso2, imports, duties, exports FROM census_trade WHERE cty_code IN (${codes.map((_, i) => `?${i + 1}`).join(',')}) ORDER BY ym`)
        .bind(...codes)
        .all<CensusRow>()
        .catch(() => ({ results: [] as CensusRow[] }))
    : { results: [] as CensusRow[] };
  return c.json({
    ...st,
    source: CENSUS_SOURCE,
    sourceUrl: CENSUS_SOURCE_URL,
    asOf,
    note: 'Census-calculated duty divided by the value of imports for consumption. It is the average rate on everything imported, including goods that enter duty-free, so it is far lower than any single tariff rate. It is not the same as what the Treasury collects in a month.',
    total: all.map(pt),
    trailing12: window ? trailingStats(window, all, all, true) : null,
    partners: top.results.map((p) => ({
      code: p.cty_code,
      iso2: p.iso2,
      name: p.cty_name,
      points: partnerRows.filter((r) => r.cty_code === p.cty_code).map((r) => pt(toPoint(r))),
    })),
    tariffDates,
  });
});

// Twelve-month imports, exports, balance, share of U.S. imports and effective rate for the countries the Compare view shows.
everydayRoute.get('/census/compare', async (c) => {
  const wanted = [...new Set((c.req.query('countries') ?? '').toUpperCase().split(',').filter((x) => /^[A-Z]{2}$/.test(x)))].slice(0, 6);
  const all = await loadAllPartners(c.env);
  const st = await censusStatus(c.env, 'census_trade', all.length > 0);
  c.header('Cache-Control', 'public, max-age=3600');
  const window = trailingWindow(all);
  if (!window || wanted.length === 0) return c.json({ ...st, source: CENSUS_SOURCE, sourceUrl: CENSUS_SOURCE_URL, asOf: null, countries: {} });
  const { results } = await c.env.DB.prepare(
    `SELECT ym, cty_code, cty_name, iso2, imports, duties, exports FROM census_trade WHERE iso2 IN (${wanted.map((_, i) => `?${i + 1}`).join(',')}) AND ym >= ?${wanted.length + 1}`
  )
    .bind(...wanted, window.months[0])
    .all<CensusRow>()
    .catch(() => ({ results: [] as CensusRow[] }));
  const countries: Record<string, ReturnType<typeof trailingStats> | null> = {};
  for (const iso of wanted) {
    const points = mergeByMonth(results.filter((r) => r.iso2 === iso));
    countries[iso] = points.length ? trailingStats(window, all, points) : null;
  }
  return c.json({ ...st, source: CENSUS_SOURCE, sourceUrl: CENSUS_SOURCE_URL, asOf: window.asOf, countries });
});

// One country's monthly series (country pages).
everydayRoute.get('/census/country/:iso', async (c) => {
  const iso = c.req.param('iso').toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso)) return c.json({ error: 'Unknown country.' }, 400);
  const all = await loadAllPartners(c.env);
  const st = await censusStatus(c.env, 'census_trade', all.length > 0);
  c.header('Cache-Control', 'public, max-age=3600');
  const { results } = await c.env.DB.prepare(`SELECT ym, cty_code, cty_name, iso2, imports, duties, exports FROM census_trade WHERE iso2 = ?1 ORDER BY ym`)
    .bind(iso)
    .all<CensusRow>()
    .catch(() => ({ results: [] as CensusRow[] }));
  const window = trailingWindow(all);
  const points = mergeByMonth(results);
  return c.json({
    ...st,
    source: CENSUS_SOURCE,
    sourceUrl: CENSUS_SOURCE_URL,
    iso2: iso,
    name: results.at(-1)?.cty_name ?? null,
    asOf: points.filter((p) => p.imports !== null).at(-1)?.ym ?? null,
    points: points.map(pt),
    trailing12: window && points.length ? trailingStats(window, all, points) : null,
  });
});

// Foreign-born residents by country of birth: the nation and the states with the most (ACS 1-year, table B05006).
everydayRoute.get('/census/foreign-born/:iso', async (c) => {
  const iso = c.req.param('iso').toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso)) return c.json({ error: 'Unknown country.' }, 400);
  const { results } = await c.env.DB.prepare(`SELECT year, geo, estimate FROM acs_foreign_born WHERE iso2 = ?1 ORDER BY estimate DESC`)
    .bind(iso)
    .all<{ year: number; geo: string; estimate: number }>()
    .catch(() => ({ results: [] as { year: number; geo: string; estimate: number }[] }));
  // Both Census jobs skip for the same reason, and the trade job writes the status row.
  const st = await censusStatus(c.env, 'census_trade', results.length > 0);
  c.header('Cache-Control', 'public, max-age=3600');
  const national = results.find((r) => r.geo === 'US') ?? null;
  return c.json({
    status: st.status,
    iso2: iso,
    year: national?.year ?? results[0]?.year ?? null,
    national: national?.estimate ?? null,
    states: results.filter((r) => r.geo !== 'US').slice(0, 12).map((r) => ({ state: r.geo, estimate: r.estimate })),
    source: 'U.S. Census Bureau, American Community Survey 1-year estimates, table B05006 (place of birth for the foreign-born population)',
    sourceUrl: 'https://data.census.gov/table/ACSDT1Y2024.B05006',
    note: 'Survey estimates with a margin of error: small state counts can be off by a wide margin. Counts people born in this country now living in the United States, regardless of citizenship.',
  });
});

// Cost of sending $200 to a country, World Bank Remittance Prices Worldwide via the open Indicators API. Two small requests, cached at the
// edge for a week (the data moves once a year), so nothing is stored and the daily database budget is untouched. Always answers 200.
const REMITTANCE_TTL = 7 * 86_400;
type RemittanceBody = { inbound: Record<string, { pct: number; year: number }>; usOutbound: { pct: number; year: number } | null };
everydayRoute.get('/remittance/:iso', async (c) => {
  const iso = c.req.param('iso').toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso)) return c.json({ error: 'Unknown country.' }, 400);
  const cache = (globalThis as unknown as { caches?: { default: Cache } }).caches?.default;
  const key = new Request('https://cache.aexterminal.internal/remittance/all');
  let body: RemittanceBody | null = null;
  const hit = await cache?.match(key);
  if (hit) body = (await hit.json()) as RemittanceBody;
  if (!body) {
    const get = (u: string) => fetch(u, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(10_000) }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const [inb, out] = await Promise.all([get(REMITTANCE_INBOUND_URL), get(REMITTANCE_US_OUTBOUND_URL)]);
    const inbound = inb ? parseWbIndicator(inb) : new Map();
    if (inbound.size > 0) {
      body = { inbound: Object.fromEntries(inbound), usOutbound: out ? (parseWbIndicator(out).get('US') ?? null) : null };
      try {
        if (cache) c.executionCtx.waitUntil(cache.put(key, new Response(JSON.stringify(body), { headers: { 'Cache-Control': `public, max-age=${REMITTANCE_TTL}` } })));
      } catch {
        /* no execution context (tests) */
      }
    }
  }
  c.header('Cache-Control', 'public, max-age=86400');
  const cost = body?.inbound[iso] ?? null;
  return c.json({
    status: !body ? 'unavailable' : cost ? 'ok' : 'not_tracked',
    iso2: iso,
    cost,
    usOutbound: body?.usOutbound ?? null,
    scope: 'Average total cost of sending USD 200 to this country, across every provider and sending country in the World Bank database, as a percent of the amount sent. It is not specific to money sent from the U.S.',
    source: REMITTANCE_SOURCE,
    sourceUrl: REMITTANCE_SOURCE_URL,
    checkedOn: new Date().toISOString().slice(0, 10),
  });
});
