// Data that ordinary visitors asked for in user testing (docs/USER-TESTING-2026-11.md): what tariffs collect, whether travel to a
// country is advised against, and (in macro.ts) everyday prices and industry jobs. Each is one keyless request to an official source,
// run in the daily job, with no model call.
import type { Env } from '../../types/env.js';
import type { RefreshResult } from '../refresh/types.js';
import { writeSeries, type SeriesMeta } from './markets.js';
import { extractCountries } from './country.js';
import { USER_AGENT } from '../refresh/userAgent.js';

const TIMEOUT_MS = 15_000;

// --- Customs duties collected (Monthly Treasury Statement, Table 4) ---
// Gross receipts are what importers paid that month; net subtracts refunds. The gap between them is itself news (refunds of duties
// later found not owed show up there), so both are kept.
export const CUSTOMS_META: SeriesMeta[] = [
  {
    id: 'TREAS:CUSTOMS_GROSS',
    label: 'Customs duties collected (gross)',
    unit: 'U.S. dollars per month',
    source: 'U.S. Treasury, Monthly Treasury Statement',
    sourceUrl: 'https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/receipts-of-the-u-s-government',
  },
  {
    id: 'TREAS:CUSTOMS_NET',
    label: 'Customs duties, net of refunds',
    unit: 'U.S. dollars per month',
    source: 'U.S. Treasury, Monthly Treasury Statement',
    sourceUrl: 'https://fiscaldata.treasury.gov/datasets/monthly-treasury-statement/receipts-of-the-u-s-government',
  },
];

interface MtsRow {
  record_date: string;
  classification_desc: string;
  current_month_gross_rcpt_amt: string;
  current_month_net_rcpt_amt: string;
}

export function parseCustomsRows(rows: MtsRow[]): { id: string; date: string; value: number }[] {
  const out: { id: string; date: string; value: number }[] = [];
  for (const r of rows) {
    if (r.classification_desc !== 'Customs Duties' || !/^\d{4}-\d{2}-\d{2}$/.test(r.record_date)) continue;
    const month = `${r.record_date.slice(0, 7)}-01`;
    const gross = Number(r.current_month_gross_rcpt_amt);
    const net = Number(r.current_month_net_rcpt_amt);
    if (Number.isFinite(gross)) out.push({ id: 'TREAS:CUSTOMS_GROSS', date: month, value: gross });
    if (Number.isFinite(net)) out.push({ id: 'TREAS:CUSTOMS_NET', date: month, value: net });
  }
  return out;
}

export async function refreshCustomsDuties(env: Env): Promise<RefreshResult> {
  const url =
    'https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/mts/mts_table_4' +
    '?filter=classification_desc:eq:Customs%20Duties&sort=-record_date&page%5Bsize%5D=96' +
    '&fields=record_date,classification_desc,current_month_gross_rcpt_amt,current_month_net_rcpt_amt';
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Treasury MTS fetch failed: HTTP ${res.status}`);
  const json = (await res.json()) as { data?: MtsRow[] };
  const rows = parseCustomsRows(json.data ?? []);
  if (rows.length === 0) throw new Error('Treasury MTS returned no customs-duty rows; the table layout may have changed');
  await writeSeries(env, CUSTOMS_META, rows);
  return { source: 'customs_duties', rows: rows.length };
}

// --- State Department travel advisories ---
// The feed tags countries with FIPS codes (the Philippines is "RP", Germany "GM"), so the country is taken from the advisory's own title
// with the same name matcher the rest of the site uses, and only kept when exactly one country matches.
export interface TravelAdvisory {
  country: string;
  level: number;
  title: string;
  url: string;
  updated: string | null;
}

export function parseAdvisories(items: { Title?: string; Link?: string; Updated?: string; Published?: string }[]): TravelAdvisory[] {
  const out: TravelAdvisory[] = [];
  const seen = new Set<string>();
  for (const it of items) {
    const title = (it.Title ?? '').trim();
    const level = Number(/Level\s+([1-4])/i.exec(title)?.[1]);
    if (!title || !Number.isFinite(level)) continue;
    const place = title.split(/\s+-\s+|\s+Travel Advisory/i)[0];
    const codes = extractCountries(place);
    if (codes.length !== 1 || seen.has(codes[0])) continue;
    seen.add(codes[0]);
    out.push({ country: codes[0], level, title, url: it.Link ?? 'https://travel.state.gov', updated: (it.Updated ?? it.Published ?? '').slice(0, 10) || null });
  }
  return out;
}

export const ADVISORY_KEY = 'travel_advisories';

export async function refreshTravelAdvisories(env: Env): Promise<RefreshResult> {
  const res = await fetch('https://cadataapi.state.gov/api/TravelAdvisories', { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`State Department advisories fetch failed: HTTP ${res.status}`);
  const items = parseAdvisories((await res.json()) as { Title?: string }[]);
  if (items.length < 50) throw new Error(`Only ${items.length} travel advisories matched a country; the feed may have changed`);
  const json = JSON.stringify(items);
  // One small row; rewritten only when an advisory changed.
  await env.DB.prepare(
    `INSERT INTO pulse_feed_state (source_key, last_success_at, last_note) VALUES (?1, ?2, ?3)
     ON CONFLICT(source_key) DO UPDATE SET last_success_at = excluded.last_success_at, last_note = excluded.last_note WHERE pulse_feed_state.last_note IS NOT excluded.last_note`
  )
    .bind(ADVISORY_KEY, new Date().toISOString(), json)
    .run();
  return { source: 'travel_advisories', rows: items.length };
}
