// The dollar's share of the world's allocated foreign-exchange reserves --
// IMF COFER (Currency Composition of Official Foreign Exchange Reserves),
// the standard real-world measure of "how much does the world still trust
// the dollar as a reserve currency." A genuinely different signal from the
// FX spot rates already tracked in markets.ts (those move day to day on
// trade flows and rate expectations; this moves over years, as central
// banks decide what to hold).
//
// Keyless and free: the IMF's SDMX 3.0 Data API (api.imf.org), verified live
// from a deployed Worker -- no registration, no rate-limit header seen.
// Quarterly data (IMF publishes with roughly a one-quarter lag), so this
// mostly no-ops when it runs in the shared daily cron slot; reusing that
// slot instead of asking for a dedicated one is the same fix already applied
// to SDN/CSL (see scheduled.ts) for staying under the Workers Free plan's
// 5-cron-trigger cap.
import type { Env } from '../../types/env.js';
import { writeSeries, type MarketMeta } from './markets.js';
import type { RefreshResult } from '../refresh/types.js';

const REQUEST_TIMEOUT_MS = 10_000;
const SERIES_ID = 'COFER:USD_SHARE';

// World (G001), Allocated reserves (AFXRA), Claims in US dollar (CI_USD),
// Shares (SHRO_PT), Quarterly (Q) -- verified against the IMF's own COFER
// codelists (CL_COFER_INDICATOR, CL_COFER_FXR_CURRENCY,
// CL_COFER_TYPE_OF_TRANSFORMATION) before hardcoding this key. The API
// ignores `startPeriod` for this dataflow and always returns full history
// back to 1999 (verified live) -- ~110 rows, small enough that there's no
// reason to fight it, so this just takes what it's given.
const DATA_URL = 'https://api.imf.org/external/sdmx/3.0/data/dataflow/IMF.STA/COFER/7.0.1/G001.AFXRA.CI_USD.SHRO_PT.Q?format=csv';

export const COFER_META: MarketMeta = {
  id: SERIES_ID,
  label: "Dollar's share of world FX reserves",
  unit: 'percent of allocated reserves',
  source: 'IMF COFER',
  sourceUrl: 'https://data.imf.org/en/datasets/IMF.STA:COFER',
  changeMode: 'absolute', // a percentage-point level, not a percent-of-a-percent
  group: 'Rates & dollar',
};

function quarterToDate(period: string): string | null {
  const m = period.match(/^(\d{4})-Q([1-4])$/);
  if (!m) return null;
  const month = { '1': '01', '2': '04', '3': '07', '4': '10' }[m[2]]!;
  return `${m[1]}-${month}-01`;
}

export async function refreshCofer(env: Env): Promise<RefreshResult> {
  const res = await fetch(DATA_URL, {
    headers: { Accept: 'application/vnd.sdmx.data+csv' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`IMF COFER fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('IMF COFER returned no rows');

  const header = lines[0].split(',');
  const timeCol = header.indexOf('TIME_PERIOD');
  const valueCol = header.indexOf('OBS_VALUE');
  if (timeCol === -1 || valueCol === -1) throw new Error('IMF COFER CSV shape changed -- expected TIME_PERIOD and OBS_VALUE columns');

  const rows: { id: string; date: string; value: number }[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(',');
    const date = quarterToDate(cols[timeCol]);
    const value = Number(cols[valueCol]);
    if (!date || !Number.isFinite(value)) continue; // skip anything unparseable rather than guess
    rows.push({ id: SERIES_ID, date, value });
  }
  if (rows.length === 0) throw new Error('IMF COFER returned no usable observations');

  await writeSeries(env, [COFER_META], rows);
  return { source: 'pulse_cofer', rows: rows.length };
}
