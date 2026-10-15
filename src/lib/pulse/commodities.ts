// Monthly commodity prices from the IMF Primary Commodity Price System (PCPS). Keyless, via the same SDMX 3.0
// host as COFER. These replace the switched-off Yahoo futures with an official, attributable source; the cost
// is cadence (monthly averages, not live quotes), which the tile's unit and as-of date state plainly.
//
// Key = COUNTRY.INDICATOR.DATA_TRANSFORMATION.FREQUENCY, verified live: G001 (world), the indicator codes
// below, USD (price in U.S. dollars), M (monthly). TIME_PERIOD comes back as "2026-M09".
import type { Env } from '../../types/env.js';
import { writeSeries, type MarketMeta } from './markets.js';
import type { RefreshResult } from '../refresh/types.js';

const REQUEST_TIMEOUT_MS = 15_000;
const SINCE = 14; // months of history to request; the markets tile window is ~14 months

const c = (code: string, label: string, unit: string): MarketMeta => ({
  id: `IMF:${code}`,
  label,
  unit,
  source: 'IMF Primary Commodity Prices',
  sourceUrl: 'https://www.imf.org/en/Research/commodity-prices',
  changeMode: 'percent',
  group: 'Commodities',
});

export const COMMODITY_META: MarketMeta[] = [
  c('POILBRE', 'Brent crude oil', 'USD per barrel, monthly average'),
  c('POILWTI', 'WTI crude oil', 'USD per barrel, monthly average'),
  c('PNGASEU', 'Natural gas (Europe)', 'USD per million BTU, monthly average'),
  c('PNGASUS', 'Natural gas (U.S. Henry Hub)', 'USD per million BTU, monthly average'),
  c('PGOLD', 'Gold', 'USD per troy ounce, monthly average'),
  c('PCOPP', 'Copper', 'USD per metric ton, monthly average'),
  c('PALUM', 'Aluminum', 'USD per metric ton, monthly average'),
  c('PNICK', 'Nickel', 'USD per metric ton, monthly average'),
  c('PIORECR', 'Iron ore', 'USD per dry metric ton, monthly average'),
  c('PWHEAMT', 'Wheat', 'USD per metric ton, monthly average'),
  c('PMAIZMT', 'Maize (corn)', 'USD per metric ton, monthly average'),
  c('PSOYB', 'Soybeans', 'USD per metric ton, monthly average'),
  c('PURAN', 'Uranium', 'USD per pound, monthly average'),
];

function periodToDate(period: string): string | null {
  const m = period.match(/^(\d{4})-M(\d{2})$/);
  return m ? `${m[1]}-${m[2]}-01` : null;
}

export function parsePcpsCsv(text: string): { id: string; date: string; value: number }[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const header = lines[0].split(',');
  const ind = header.indexOf('INDICATOR');
  const time = header.indexOf('TIME_PERIOD');
  const val = header.indexOf('OBS_VALUE');
  if (ind === -1 || time === -1 || val === -1) throw new Error('IMF PCPS CSV shape changed -- expected INDICATOR, TIME_PERIOD and OBS_VALUE columns');
  const known = new Set(COMMODITY_META.map((m) => m.id));
  const rows: { id: string; date: string; value: number }[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(',');
    const id = `IMF:${cols[ind]}`;
    const date = periodToDate(cols[time] ?? '');
    const value = Number(cols[val]);
    if (!known.has(id) || !date || !Number.isFinite(value)) continue;
    rows.push({ id, date, value });
  }
  return rows;
}

export async function refreshCommodities(env: Env): Promise<RefreshResult> {
  const codes = COMMODITY_META.map((m) => m.id.slice(4)).join('+');
  const from = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() - SINCE, 1)).toISOString().slice(0, 7);
  const url = `https://api.imf.org/external/sdmx/3.0/data/dataflow/IMF.RES/PCPS/9.0.0/G001.${codes}.USD.M?format=csv&c%5BTIME_PERIOD%5D=ge:${from}`;
  const res = await fetch(url, { headers: { Accept: 'application/vnd.sdmx.data+csv' }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`IMF PCPS fetch failed: HTTP ${res.status}`);
  const rows = parsePcpsCsv(await res.text());
  if (rows.length === 0) throw new Error('IMF PCPS returned no usable observations');
  await writeSeries(env, COMMODITY_META, rows);
  return { source: 'pulse_commodities', rows: rows.length };
}
