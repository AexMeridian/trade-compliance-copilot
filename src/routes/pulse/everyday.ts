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
import { USER_AGENT } from '../../lib/refresh/userAgent.js';

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
    // Tariff dates to mark on the charts, from the site's own hand-verified overlay table.
    c.env.DB.prepare(
      `SELECT program, MIN(effective_date) AS since, MAX(rate_pct) AS rate, MIN(legal_basis) AS legal_basis, MIN(source_url) AS source_url
       FROM tariff_overlays WHERE program IN ('sec232_steel','sec232_aluminum','sec232_copper','sec232_autos','sec232_auto_parts','sec301_forced_labor')
         AND (expiration_date IS NULL OR expiration_date >= date('now')) GROUP BY program`
    )
      .all<{ program: string; since: string; rate: number | null; legal_basis: string; source_url: string }>()
      .then((r) => r.results)
      .catch(() => []),
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
  if (hit) return hit;
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
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({
    hts: line.htsno,
    description: line.description.replace(/<\/?[a-z]+>/gi, ''),
    country,
    generalRate: line.general_rate,
    revision: line.revision,
    totalPct: result.totalPct,
    lines: result.lines,
    note:
      'Estimate from the tariff layers this site models (HTS rate, Section 232, Section 301 forced-labor, Section 338). Antidumping and countervailing duties, the 2018-2019 Section 301 lists on China, fees, freight and USMCA treatment are not included. Not a ruling: confirm with a licensed customs broker.',
  });
});
