// U.S. Treasury open data: the daily par yield curve and the monthly "Major Foreign Holders of Treasury
// Securities" table (TIC). Both are U.S. government works, keyless, and land in market_series as plain
// (series, date, value) rows -- nothing derived here; changes are computed at read time.
//
// Yield curve: the Treasury's XML feed is one Atom entry per business day. The current and previous month are
// fetched so a refresh in the first days of a month still has a prior value to compare with.
// TIC table: slt_table5.txt is tab-separated, newest month first, one row per country plus totals.
import type { Env } from '../../types/env.js';
import { writeSeries, type MarketMeta, type SeriesMeta } from './markets.js';
import type { RefreshResult } from '../refresh/types.js';
import { USER_AGENT as UA } from '../refresh/userAgent.js';

const REQUEST_TIMEOUT_MS = 10_000;
// home.treasury.gov answers the yield-curve feed slowly (about 17 s measured), so it gets a longer limit.
const YIELD_TIMEOUT_MS = 30_000;
const YIELD_BASE = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value_month=';
const YIELD_PAGE = 'https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve';
const TIC_URL = 'https://ticdata.treasury.gov/resource-center/data-chart-center/tic/Documents/slt_table5.txt';
const TIC_PAGE = 'https://ticdata.treasury.gov/resource-center/data-chart-center/tic/Pages/index.aspx';

const yieldMeta = (id: string, label: string): MarketMeta => ({
  id,
  label,
  unit: 'percent',
  source: 'U.S. Treasury',
  sourceUrl: YIELD_PAGE,
  changeMode: 'absolute',
  group: 'Rates & dollar',
});

// Field names in the Treasury XML -> series. A short, readable cross-section of the curve.
const YIELD_FIELDS: { field: string; meta: MarketMeta }[] = [
  { field: 'BC_3MONTH', meta: yieldMeta('UST:3M', '3-month Treasury yield') },
  { field: 'BC_2YEAR', meta: yieldMeta('UST:2Y', '2-year Treasury yield') },
  { field: 'BC_10YEAR', meta: yieldMeta('UST:10Y', '10-year Treasury yield') },
  { field: 'BC_30YEAR', meta: yieldMeta('UST:30Y', '30-year Treasury yield') },
];
export const YIELD_META: MarketMeta[] = YIELD_FIELDS.map((f) => f.meta);

// TIC country names -> ISO 3166-1 alpha-2. A name not listed is skipped, never guessed.
const TIC_COUNTRIES: Record<string, string> = {
  Japan: 'JP', 'United Kingdom': 'GB', 'China, Mainland': 'CN', Belgium: 'BE', 'Cayman Islands': 'KY', Luxembourg: 'LU', Canada: 'CA',
  Ireland: 'IE', France: 'FR', Taiwan: 'TW', Switzerland: 'CH', Singapore: 'SG', 'Hong Kong': 'HK', Norway: 'NO', India: 'IN', Brazil: 'BR',
  'Saudi Arabia': 'SA', 'Korea, South': 'KR', 'United Arab Emirates': 'AE', Bermuda: 'BM', Germany: 'DE', Netherlands: 'NL', Italy: 'IT',
  Israel: 'IL', Mexico: 'MX', Thailand: 'TH', Philippines: 'PH', Kuwait: 'KW', Turkey: 'TR', Poland: 'PL', Australia: 'AU', Spain: 'ES',
  Sweden: 'SE', Colombia: 'CO', Vietnam: 'VN', Indonesia: 'ID', Malaysia: 'MY', Chile: 'CL', Qatar: 'QA', Oman: 'OM', Nigeria: 'NG',
  Kazakhstan: 'KZ', Russia: 'RU', 'South Africa': 'ZA', Egypt: 'EG', Peru: 'PE', Denmark: 'DK', Finland: 'FI', Austria: 'AT', Portugal: 'PT',
};
export const TIC_TOTAL_ID = 'TIC:TOTAL';
export const TIC_OFFICIAL_ID = 'TIC:OFFICIAL';

const ticMeta = (id: string, label: string): SeriesMeta => ({
  id,
  label,
  unit: 'billions of USD, end of month',
  source: 'U.S. Treasury TIC',
  sourceUrl: TIC_PAGE,
});

async function fetchText(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<string> {
  const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Treasury fetch failed (${url.split('?')[0]}): HTTP ${res.status}`);
  return res.text();
}

export function parseYieldXml(xml: string): { id: string; date: string; value: number }[] {
  const out: { id: string; date: string; value: number }[] = [];
  for (const props of xml.match(/<m:properties>[\s\S]*?<\/m:properties>/g) ?? []) {
    const date = props.match(/<d:NEW_DATE[^>]*>(\d{4}-\d{2}-\d{2})/)?.[1];
    if (!date) continue;
    for (const { field, meta } of YIELD_FIELDS) {
      const raw = props.match(new RegExp(`<d:${field}[^>]*>([0-9.]+)<`))?.[1];
      const value = raw === undefined ? NaN : Number(raw);
      if (Number.isFinite(value)) out.push({ id: meta.id, date, value });
    }
  }
  return out;
}

export function parseTicTable(text: string): { meta: SeriesMeta[]; rows: { id: string; date: string; value: number }[] } {
  const lines = text.split(/\r?\n/).map((l) => l.split('\t'));
  const headerIdx = lines.findIndex((c) => c[0]?.trim() === 'Country' && /^\d{4}-\d{2}$/.test(c[1]?.trim() ?? ''));
  if (headerIdx === -1) throw new Error('Treasury TIC table shape changed -- no "Country" header row with YYYY-MM columns');
  const months = lines[headerIdx].slice(1).map((m) => m.trim());
  const meta: SeriesMeta[] = [];
  const rows: { id: string; date: string; value: number }[] = [];
  for (const cols of lines.slice(headerIdx + 1)) {
    const name = cols[0]?.trim();
    if (!name) continue;
    let id: string | null = null;
    let label = '';
    if (name === 'Grand Total') {
      id = TIC_TOTAL_ID;
      label = 'Foreign holdings of U.S. Treasuries: all countries';
    } else if (name === 'Of Which: Foreign Official') {
      id = TIC_OFFICIAL_ID;
      label = 'Foreign holdings of U.S. Treasuries: official holders';
    } else if (TIC_COUNTRIES[name]) {
      id = `TIC:${TIC_COUNTRIES[name]}`;
      label = `Foreign holdings of U.S. Treasuries: ${name.replace(/^(.*), (Mainland|South)$/, (_m, a, b) => (b === 'South' ? `${a}, South` : a))}`;
    }
    if (!id) continue;
    let any = false;
    months.forEach((m, i) => {
      const value = Number(cols[i + 1]?.trim());
      if (!/^\d{4}-\d{2}$/.test(m) || !Number.isFinite(value)) return;
      rows.push({ id: id!, date: `${m}-01`, value });
      any = true;
    });
    if (any) meta.push(ticMeta(id, label));
  }
  return { meta, rows };
}

export async function refreshTreasury(env: Env): Promise<RefreshResult> {
  const now = new Date();
  const ym = (d: Date) => `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const prev = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));

  // The two Treasury sites fail independently: the fast TIC table must not be lost because the slow yield feed timed out.
  const [yieldsRes, ticRes] = await Promise.allSettled([
    Promise.all([fetchText(YIELD_BASE + ym(prev), YIELD_TIMEOUT_MS), fetchText(YIELD_BASE + ym(now), YIELD_TIMEOUT_MS)]).then(([a, b]) => [...parseYieldXml(a), ...parseYieldXml(b)]),
    fetchText(TIC_URL).then(parseTicTable),
  ]);

  const meta: SeriesMeta[] = [];
  const rows: { id: string; date: string; value: number }[] = [];
  const problems: string[] = [];
  if (yieldsRes.status === 'fulfilled' && yieldsRes.value.length > 0) {
    meta.push(...YIELD_META);
    rows.push(...yieldsRes.value);
  } else problems.push(`yield curve: ${yieldsRes.status === 'rejected' ? (yieldsRes.reason as Error).message : 'no usable observations'}`);
  if (ticRes.status === 'fulfilled' && ticRes.value.rows.length > 0) {
    meta.push(...ticRes.value.meta);
    rows.push(...ticRes.value.rows);
  } else problems.push(`TIC table: ${ticRes.status === 'rejected' ? (ticRes.reason as Error).message : 'no usable observations'}`);

  if (rows.length === 0) throw new Error(`Treasury refresh failed -- ${problems.join('; ')}`);
  await writeSeries(env, meta, rows);
  if (problems.length > 0) throw new Error(`Treasury partly refreshed (${rows.length} rows written) -- ${problems.join('; ')}`);
  return { source: 'pulse_treasury', rows: rows.length };
}
