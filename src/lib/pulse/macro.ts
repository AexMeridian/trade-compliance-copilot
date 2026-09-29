// U.S. macroeconomic indicators from the Bureau of Labor Statistics' public
// API -- the kind of headline number (inflation, jobs, import prices) that a
// Bloomberg terminal or the WSJ front page leads with and this app didn't
// have at all before: everything else here answers "what did the government
// do" or "how did markets move," not "how is the economy actually doing."
// Import/export price indexes in particular are the closest real, published
// measure of whether tariffs are actually showing up in prices.
//
// Keyless and free (BLS's public API works without registration, verified
// live from a deployed Worker): 25 queries/day and 10 years of history per
// query at that tier, comfortably enough for a page that refreshes at most
// a few times a day. Set BLS_API_KEY (a free instant signup at
// https://www.bls.gov/developers/) to raise that to 500 queries/day/20
// years -- optional, and the fetch degrades to keyless if it's unset.
//
// FRED (Treasury yields beyond the 10-year, Fed funds rate, reserve-currency
// share) and Census Bureau's international trade API (actual $ trade
// balance by country) would add more of this same kind of context, but both
// require a free account and API key that only the site owner can create --
// left for later rather than assumed here. See the Guide tab.
import type { Env } from '../../types/env.js';
import { writeSeries, type MarketMeta } from './markets.js';
import type { RefreshResult } from '../refresh/types.js';

const REQUEST_TIMEOUT_MS = 10_000;

// Our own series id (stored in market_series) -> the real BLS series id.
const MACRO_SERIES: { id: string; blsId: string; label: string; unit: string; changeMode: 'percent' | 'absolute' }[] = [
  { id: 'BLS:CPI', blsId: 'CUUR0000SA0', label: 'Consumer prices (CPI)', unit: 'index, 1982-84=100', changeMode: 'percent' },
  { id: 'BLS:UNRATE', blsId: 'LNS14000000', label: 'Unemployment rate', unit: 'percent', changeMode: 'absolute' },
  { id: 'BLS:PAYROLLS', blsId: 'CES0000000001', label: 'Nonfarm payrolls', unit: 'thousands of jobs', changeMode: 'absolute' },
  { id: 'BLS:PPI', blsId: 'WPSFD4', label: 'Producer prices (PPI)', unit: 'index, Nov 2009=100', changeMode: 'percent' },
  { id: 'BLS:IMPORT_PX', blsId: 'EIUIR', label: 'Import prices', unit: 'index, 2000=100', changeMode: 'percent' },
  { id: 'BLS:EXPORT_PX', blsId: 'EIUIQ', label: 'Export prices', unit: 'index, 2000=100', changeMode: 'percent' },
];

export const MACRO_META: MarketMeta[] = MACRO_SERIES.map((s) => ({
  id: s.id,
  label: s.label,
  unit: s.unit,
  source: 'U.S. Bureau of Labor Statistics',
  sourceUrl: `https://data.bls.gov/timeseries/${s.blsId}`,
  changeMode: s.changeMode,
  group: 'Macro',
}));

interface BlsObservation {
  year: string;
  period: string; // "M01".."M12" for real months, "M13" is the annual average -- skipped
  value: string; // "-" marks a gap (e.g. a lapse in appropriations); skipped, never treated as 0
  latest?: string;
}
interface BlsResponse {
  status: string;
  message?: string[];
  Results?: { series: { seriesID: string; data: BlsObservation[] }[] };
}

export async function refreshMacro(env: Env): Promise<RefreshResult> {
  const now = new Date();
  const body: Record<string, unknown> = {
    seriesid: MACRO_SERIES.map((s) => s.blsId),
    startyear: String(now.getUTCFullYear() - 2),
    endyear: String(now.getUTCFullYear()),
  };
  if (env.BLS_API_KEY) body.registrationkey = env.BLS_API_KEY;

  const res = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`BLS fetch failed: HTTP ${res.status}`);
  const json = (await res.json()) as BlsResponse;
  if (json.status !== 'REQUEST_SUCCEEDED') throw new Error(`BLS request rejected: ${json.message?.join('; ') || json.status}`);

  const byBlsId = new Map(json.Results?.series.map((s) => [s.seriesID, s.data]) ?? []);
  const rows: { id: string; date: string; value: number }[] = [];
  for (const s of MACRO_SERIES) {
    for (const obs of byBlsId.get(s.blsId) ?? []) {
      if (!/^M(0[1-9]|1[0-2])$/.test(obs.period)) continue; // skip M13 (annual average)
      const value = Number(obs.value);
      if (!Number.isFinite(value)) continue; // skip "-" gaps
      rows.push({ id: s.id, date: `${obs.year}-${obs.period.slice(1)}-01`, value });
    }
  }
  if (rows.length === 0) throw new Error('BLS returned no usable observations');
  await writeSeries(env, MACRO_META, rows);
  return { source: 'pulse_macro', rows: rows.length };
}
