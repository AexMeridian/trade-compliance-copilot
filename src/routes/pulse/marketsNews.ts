import { Hono, type Context } from 'hono';
import type { Env } from '../../types/env.js';
import { MARKET_META, FX_META, refreshQuotes, refreshFx } from '../../lib/pulse/markets.js';
import { MACRO_META, refreshMacro } from '../../lib/pulse/macro.js';
import { COFER_META, refreshCofer } from '../../lib/pulse/cofer.js';
import { refreshNews } from '../../lib/pulse/news.js';
import { refreshIfStale } from '../../lib/pulse/refreshLazy.js';
import type { PulseApp } from './util.js';
import { clampInt } from './util.js';

export const marketsNewsRoute: PulseApp = new Hono<{ Bindings: Env }>();

const FX_TTL_MS = 30 * 60_000;

const QUOTES_TTL_MS = 15 * 60_000;
 // Yahoo data is itself ~15 min delayed
const NEWS_TTL_MS = 30 * 60_000;

const MACRO_TTL_MS = 6 * 60 * 60_000;
 // BLS publishes monthly; this just bounds the keyless daily-query budget
const COFER_TTL_MS = 24 * 60 * 60_000;
 // IMF publishes quarterly; this just bounds the keyless daily-query budget

// First-ever request (empty table) waits for the refresh so the panel isn't
// blank; every later request answers from D1 immediately and refreshes in
// the background, so a stale cache never makes a page load slower.
async function refreshOnDemand(c: Context<{ Bindings: Env }>, tasks: Promise<void>[], tableIsEmpty: boolean) {
  const all = Promise.all(tasks).then(() => undefined);
  if (tableIsEmpty) {
    await all;
    return;
  }
  try {
    c.executionCtx.waitUntil(all);
  } catch {
    await all;
  }
}

interface SeriesRow {
  series_id: string;
  obs_date: string;
  value: number;
}

const NEWS_CATEGORIES = ['Trade & Supply Chain', 'Markets & Currency', 'Elections & Politics', 'Official'];

marketsNewsRoute.get('/markets', async (c) => {
  // How many daily points each tile's chart series carries -- default (70,
  // ~3 months) is unchanged for every existing caller; a range selector on
  // the frontend can request more, up to as much as market_series retains.
  const days = clampInt(c.req.query('days'), { default: 70, min: 30, max: 430 });
  const load = () =>
    c.env.DB.prepare(
      `SELECT series_id, obs_date, value FROM market_series
       WHERE obs_date >= date('now', '-430 days')
       ORDER BY series_id, obs_date DESC`
    ).all<SeriesRow>();

  const quotesOn = c.env.MARKET_QUOTES !== 'off';
  let { results } = await load();
  // Wait for the fetch (instead of refreshing in the background) whenever
  // FX, quote or macro data is missing entirely, so a first visit after a
  // deploy isn't served a half-empty page.
  const hasQuotes = !quotesOn || results.some((r) => r.series_id === '^GSPC');
  const hasFx = results.some((r) => r.series_id.startsWith('FX:'));
  const hasMacro = results.some((r) => r.series_id.startsWith('BLS:'));
  const hasCofer = results.some((r) => r.series_id === 'COFER:USD_SHARE');
  await refreshOnDemand(
    c,
    [
      refreshIfStale(c.env, 'fx', FX_TTL_MS, () => refreshFx(c.env)),
      ...(quotesOn ? [refreshIfStale(c.env, 'quotes', QUOTES_TTL_MS, () => refreshQuotes(c.env))] : []),
      refreshIfStale(c.env, 'macro', MACRO_TTL_MS, () => refreshMacro(c.env)),
      refreshIfStale(c.env, 'cofer', COFER_TTL_MS, () => refreshCofer(c.env)),
    ],
    !hasQuotes || !hasFx || !hasMacro || !hasCofer
  );
  if (!hasQuotes || !hasFx || !hasMacro || !hasCofer) ({ results } = await load());

  const bySeries = new Map<string, SeriesRow[]>();
  for (const r of results) {
    if (!bySeries.has(r.series_id)) bySeries.set(r.series_id, []);
    bySeries.get(r.series_id)!.push(r); // newest first
  }

  // Oldest-to-newest [date, value] pairs for charts: ~3 months of daily closes.
  const points = (rows: SeriesRow[], n: number): [string, number][] =>
    rows
      .slice(0, n)
      .map((r): [string, number] => [r.obs_date, r.value])
      .reverse();

  const tiles = [...(quotesOn ? MARKET_META : []), ...MACRO_META, COFER_META].flatMap((m) => {
    const rows = bySeries.get(m.id);
    if (!rows || rows.length === 0) return [];
    const [latest, prev] = rows;
    const change = prev ? latest.value - prev.value : null;
    // Year-over-year, for the monthly macro series: the newest observation at
    // or before 360 days prior to the latest one. Not meaningful for daily
    // market data (a "year ago" stock price is a different kind of fact than
    // "up 3 months"), so only computed for the Macro group.
    let yoyChangePct: number | null = null;
    if (m.group === 'Macro') {
      const edge = new Date(Date.parse(latest.obs_date) - 360 * 86_400_000).toISOString().slice(0, 10);
      const base = rows.find((r) => r.obs_date <= edge);
      if (base && base.obs_date !== latest.obs_date && base.value !== 0 && m.changeMode === 'percent') {
        yoyChangePct = ((latest.value - base.value) / base.value) * 100;
      }
    }
    return [
      {
        id: m.id,
        label: m.label,
        group: m.group,
        unit: m.unit,
        source: m.source,
        sourceUrl: m.sourceUrl,
        value: latest.value,
        asOf: latest.obs_date,
        change,
        changePct: change !== null && prev && prev.value !== 0 && m.changeMode === 'percent' ? (change / prev.value) * 100 : null,
        changeMode: m.changeMode,
        yoyChangePct,
        points: points(rows, days),
      },
    ];
  });

  const currencies = FX_META.flatMap((m) => {
    const rows = bySeries.get(m.id);
    if (!rows || rows.length === 0) return [];
    const latest = rows[0];
    // ~30-day comparison: the newest observation at or before 30 days prior to
    // the latest, else the oldest we have (early in a fresh backfill).
    const edge = new Date(Date.parse(latest.obs_date) - 30 * 86_400_000).toISOString().slice(0, 10);
    const base = rows.find((r) => r.obs_date <= edge) ?? rows[rows.length - 1];
    return [
      {
        quote: m.id.slice(3),
        label: m.label,
        rate: latest.value,
        asOf: latest.obs_date,
        change30dPct: base.obs_date !== latest.obs_date && base.value !== 0 ? ((latest.value - base.value) / base.value) * 100 : null,
        spark: rows
          .slice(0, 30)
          .map((r) => r.value)
          .reverse(),
        sparkDates: rows
          .slice(0, 30)
          .map((r) => r.obs_date)
          .reverse(),
      },
    ];
  });

  return c.json({ tiles, currencies });
});

marketsNewsRoute.get('/news', async (c) => {
  const limit = clampInt(c.req.query('limit'), { default: 30, min: 1, max: 60 });
  const requested = c.req.query('category') || null;
  const category = requested && NEWS_CATEGORIES.includes(requested) ? requested : null;

  const empty = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM world_news').first<{ n: number }>();
  await refreshOnDemand(c, [refreshIfStale(c.env, 'news', NEWS_TTL_MS, () => refreshNews(c.env))], (empty?.n ?? 0) === 0);

  const { results } = await c.env.DB.prepare(
    `SELECT id, title, summary, url, source, category, countries, published_at, image_url FROM world_news
     WHERE (?1 IS NULL OR category = ?1) ORDER BY published_at DESC LIMIT ?2`
  )
    .bind(category, limit)
    .all();
  const counts = await c.env.DB.prepare(
    `SELECT category, COUNT(*) AS n FROM world_news WHERE published_at >= date('now', '-7 days') GROUP BY category`
  ).all<{ category: string; n: number }>();
  const state = await c.env.DB.prepare(`SELECT last_success_at, last_note FROM pulse_feed_state WHERE source_key = 'news'`).first<{
    last_success_at: string | null;
    last_note: string | null;
  }>();

  const showImages = c.env.NEWS_IMAGES !== 'off';
  return c.json({
    items: showImages ? results : results.map((r) => ({ ...r, image_url: null })),
    counts: Object.fromEntries(counts.results.map((r) => [r.category, r.n])),
    lastSuccessAt: state?.last_success_at ?? null,
    note: state?.last_note ?? null,
  });
});
