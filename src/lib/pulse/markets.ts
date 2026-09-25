// Currency rates (Frankfurter, which republishes the ECB's daily reference
// rates -- verified live, keyless) and stock/commodity/rate quotes (Yahoo
// Finance's public chart data, delayed). Everything lands in market_series
// as plain (series, date, value) rows -- no derived or model-generated
// values; changes/percentages are computed at read time in routes/pulse.ts.
//
// Yahoo, not FRED: FRED's keyless CSV endpoint answers Cloudflare Workers
// with HTTP 520 (verified from Worker egress), and its keyed API needs an
// account. Yahoo's chart data answers Workers with 200 and covers indices,
// individual stocks and futures in two requests. It is an unofficial,
// undocumented endpoint, so this is best-effort: a failure shows up in the
// refresh note and the rest of Pulse keeps working.
import type { Env } from '../../types/env.js';
import { buildInsertStatements, sqlString } from '../refresh/sql.js';
import type { RefreshResult } from '../refresh/types.js';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const FX_UA = 'trade-compliance-copilot-research/1.0 (portfolio project data loader)';
const REQUEST_TIMEOUT_MS = 10_000;

export const FX_QUOTES = ['EUR', 'CNY', 'JPY', 'MXN', 'CAD', 'GBP', 'INR', 'KRW'] as const;

export interface SeriesMeta {
  id: string;
  label: string;
  unit: string;
  source: string;
  sourceUrl: string;
}

export const FX_META: SeriesMeta[] = FX_QUOTES.map((q) => ({
  id: `FX:${q}`,
  label: `USD/${q}`,
  unit: `${q} per 1 USD`,
  source: 'Frankfurter (ECB reference rates)',
  sourceUrl: 'https://frankfurter.dev',
}));

// `changeMode` says how a reader should interpret movement: percent change
// for a level (an index, a price), or an absolute difference for a rate or
// gauge where "percent of a percent" would mislead. `group` only decides
// which panel a tile is shown in.
export type MarketGroup = 'U.S. stocks' | 'World stocks' | 'Trade bellwethers' | 'Commodities' | 'Rates & dollar';
export interface MarketMeta extends SeriesMeta {
  changeMode: 'percent' | 'absolute';
  group: MarketGroup;
}
const quote = (
  id: string,
  label: string,
  unit: string,
  group: MarketGroup,
  changeMode: 'percent' | 'absolute' = 'percent'
): MarketMeta => ({
  id,
  label,
  unit,
  source: 'Yahoo Finance',
  sourceUrl: `https://finance.yahoo.com/quote/${encodeURIComponent(id)}`,
  changeMode,
  group,
});

// Trade bellwethers: companies whose results move with global trade volumes
// (carriers, heavy-equipment and aircraft exporters, big importers, the chip
// supply chain). A watch-list, not a recommendation.
export const MARKET_META: MarketMeta[] = [
  quote('^GSPC', 'S&P 500', 'index points', 'U.S. stocks'),
  quote('^IXIC', 'Nasdaq Composite', 'index points', 'U.S. stocks'),
  quote('^DJI', 'Dow Jones', 'index points', 'U.S. stocks'),
  quote('^VIX', 'VIX (fear gauge)', 'index points', 'U.S. stocks', 'absolute'),
  quote('^N225', 'Nikkei 225 (Japan)', 'index points', 'World stocks'),
  quote('^GDAXI', 'DAX (Germany)', 'index points', 'World stocks'),
  quote('^FTSE', 'FTSE 100 (U.K.)', 'index points', 'World stocks'),
  quote('^HSI', 'Hang Seng (Hong Kong)', 'index points', 'World stocks'),
  quote('000001.SS', 'Shanghai Composite', 'index points', 'World stocks'),
  quote('FDX', 'FedEx', 'USD per share', 'Trade bellwethers'),
  quote('UPS', 'UPS', 'USD per share', 'Trade bellwethers'),
  quote('ZIM', 'ZIM (container shipping)', 'USD per share', 'Trade bellwethers'),
  quote('CAT', 'Caterpillar', 'USD per share', 'Trade bellwethers'),
  quote('BA', 'Boeing', 'USD per share', 'Trade bellwethers'),
  quote('AAPL', 'Apple', 'USD per share', 'Trade bellwethers'),
  quote('WMT', 'Walmart', 'USD per share', 'Trade bellwethers'),
  quote('TSM', 'TSMC (chips)', 'USD per ADR', 'Trade bellwethers'),
  quote('CL=F', 'WTI crude oil', 'USD per barrel', 'Commodities'),
  quote('BZ=F', 'Brent crude oil', 'USD per barrel', 'Commodities'),
  quote('NG=F', 'Natural gas', 'USD per million BTU', 'Commodities'),
  quote('GC=F', 'Gold', 'USD per troy ounce', 'Commodities'),
  quote('HG=F', 'Copper', 'USD per pound', 'Commodities'),
  quote('^TNX', '10-year Treasury yield', 'percent', 'Rates & dollar', 'absolute'),
  quote('DX-Y.NYB', 'U.S. dollar index', 'index points', 'Rates & dollar'),
];

const FX_WINDOW_DAYS = 45;
const SPARK_CHUNK = 12; // Yahoo's spark endpoint accepts at most 20 symbols per request

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

async function writeSeries(env: Env, meta: SeriesMeta[], rows: { id: string; date: string; value: number }[]): Promise<void> {
  const now = new Date().toISOString();
  const valueRows = rows.map((r) => `(${sqlString(r.id)}, ${sqlString(r.date)}, ${r.value})`);
  const metaRows = meta.map(
    (m) => `(${sqlString(m.id)}, ${sqlString(m.label)}, ${sqlString(m.unit)}, ${sqlString(m.source)}, ${sqlString(m.sourceUrl)}, ${sqlString(now)})`
  );
  await env.DB.batch([
    ...buildInsertStatements(
      'INSERT INTO market_series (series_id, obs_date, value) VALUES',
      valueRows,
      300,
      'ON CONFLICT(series_id, obs_date) DO UPDATE SET value = excluded.value'
    ).map((s) => env.DB.prepare(s)),
    ...buildInsertStatements(
      'INSERT INTO market_series_meta (series_id, label, unit, source, source_url, last_fetched_at) VALUES',
      metaRows,
      50,
      `ON CONFLICT(series_id) DO UPDATE SET label = excluded.label, unit = excluded.unit, source = excluded.source,
         source_url = excluded.source_url, last_fetched_at = excluded.last_fetched_at`
    ).map((s) => env.DB.prepare(s)),
  ]);
}

export async function refreshFx(env: Env): Promise<RefreshResult> {
  const url = `https://api.frankfurter.dev/v1/${isoDaysAgo(FX_WINDOW_DAYS)}..${isoDaysAgo(0)}?base=USD&symbols=${FX_QUOTES.join(',')}`;
  const res = await fetch(url, { headers: { 'User-Agent': FX_UA }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Frankfurter fetch failed: HTTP ${res.status}`);
  const body = (await res.json()) as { rates: Record<string, Record<string, number>> };

  const rows: { id: string; date: string; value: number }[] = [];
  for (const [date, quotes] of Object.entries(body.rates ?? {})) {
    for (const [q, value] of Object.entries(quotes)) {
      if (typeof value === 'number' && Number.isFinite(value)) rows.push({ id: `FX:${q}`, date, value });
    }
  }
  if (rows.length === 0) throw new Error('Frankfurter returned no rates');
  await writeSeries(env, FX_META, rows);
  return { source: 'pulse_fx', rows: rows.length };
}

// Shape of Yahoo's spark response: { "<SYMBOL>": { timestamp: [unix secs],
// close: [number | null] } }. A null close (no trade that bar) is skipped,
// never filled. The final bar is the live/most recent price, so a refresh
// overwrites today's row rather than adding one.
interface SparkEntry {
  timestamp?: number[];
  close?: (number | null)[];
}

async function fetchSparkChunk(symbols: string[]): Promise<{ id: string; date: string; value: number }[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/spark?symbols=${symbols.map(encodeURIComponent).join(',')}&range=3mo&interval=1d`;
  let lastError = '';
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 500));
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }
      const body = (await res.json()) as Record<string, SparkEntry>;
      const rows: { id: string; date: string; value: number }[] = [];
      for (const [id, entry] of Object.entries(body)) {
        const ts = entry?.timestamp ?? [];
        const close = entry?.close ?? [];
        ts.forEach((t, i) => {
          const v = close[i];
          if (typeof v === 'number' && Number.isFinite(v)) rows.push({ id, date: new Date(t * 1000).toISOString().slice(0, 10), value: v });
        });
      }
      if (rows.length > 0) return rows;
      lastError = 'empty response';
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }
  throw new Error(lastError);
}

export async function refreshQuotes(env: Env): Promise<RefreshResult & { note?: string }> {
  const ids = MARKET_META.map((m) => m.id);
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += SPARK_CHUNK) chunks.push(ids.slice(i, i + SPARK_CHUNK));

  const settled = await Promise.allSettled(chunks.map(fetchSparkChunk));
  const rows = settled.flatMap((s) => (s.status === 'fulfilled' ? s.value : []));
  const failures = settled.flatMap((s, i) => (s.status === 'rejected' ? [`${chunks[i].join(', ')} (${(s.reason as Error).message})`] : []));
  if (rows.length === 0) throw new Error(`Yahoo returned no quotes. Failed: ${failures.join('; ')}`);

  await writeSeries(env, MARKET_META, rows);
  return { source: 'pulse_quotes', rows: rows.length, note: failures.length ? `Unavailable this run: ${failures.join('; ')}` : undefined };
}
