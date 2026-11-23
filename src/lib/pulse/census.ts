// U.S. Census Bureau data that needs the free CENSUS_API_KEY (api.census.gov/data/key_signup.html):
//   1. Monthly U.S. imports for consumption, Census-calculated duties and exports by partner country (international trade API,
//      timeseries/intltrade/imports/hs and exports/hs). From these: the effective tariff rate (duties / imports), total and by partner.
//   2. Foreign-born population by country of birth, nation and state (American Community Survey 1-year table B05006).
// Without the key every function here returns at once with a "needs CENSUS_API_KEY" status and touches nothing, so the daily job never fails
// for want of it. Variable names were checked against the public variables.json files of both trade endpoints and the B05006 group file; the
// data calls themselves need a key and were not run from the repository (see docs/OWNER-TODO.md).
//
// Workers Free budget: at most MAX_REQUESTS outbound requests and a few database batches per invocation; rows are upserted only when a
// value changed. The first run backfills from 2018-01 newest-first over several days.
import type { Env } from '../../types/env.js';
import type { RefreshResult } from '../refresh/types.js';
import { sqlString, buildInsertStatements } from '../refresh/sql.js';
import { USER_AGENT } from '../refresh/userAgent.js';
import { COUNTRY_LABELS, NAMES_THE_TEXT_EXTRACTOR_SKIPS, extractCountries } from './country.js';

export const NEEDS_KEY = 'Skipped: needs CENSUS_API_KEY (free at api.census.gov/data/key_signup.html; set with: npx wrangler secret put CENSUS_API_KEY)';
const TIMEOUT_MS = 25_000;
export const MAX_REQUESTS = 40; // leaves room under the 50-subrequest limit for the status writes
export const FIRST_MONTH = '2018-01';
const TRADE_BASE = 'https://api.census.gov/data/timeseries/intltrade';
export const CENSUS_SOURCE_URL = 'https://www.census.gov/foreign-trade/data/index.html';

// --- Pure helpers (tested with saved fixtures) ---

/** Rate in percent, or null when there were no imports. */
export function effectiveRatePct(duties: number | null | undefined, imports: number | null | undefined): number | null {
  if (duties === null || duties === undefined || imports === null || imports === undefined || !(imports > 0) || duties < 0) return null;
  return Math.round((duties / imports) * 10_000) / 100;
}

export interface PartnerMonth {
  code: string;
  name: string;
  value: number;
  duties: number;
}

// Census names that the site's country matcher would miss or read wrongly. Lower case.
const CENSUS_ALIASES: Record<string, string> = {
  'korea, south': 'KR', 'korea, north': 'KP', korea: 'KR', 'china, excluding hong kong and taiwan': 'CN', 'hong kong': 'HK', taiwan: 'TW', burma: 'MM',
  'burma (myanmar)': 'MM', laos: 'LA', 'russia': 'RU', 'united kingdom': 'GB', 'czech republic': 'CZ', singapore: 'SG', turkey: 'TR', 'ivory coast': 'CI',
  "cote d'ivoire": 'CI', 'congo (kinshasa)': 'CD', 'congo (brazzaville)': 'CG', 'democratic republic of congo (zaire)': 'CD', congo: 'CG',
  'north macedonia (macedonia)': 'MK', 'cabo verde': 'CV', moldova: 'MD', syria: 'SY', iran: 'IR', venezuela: 'VE', bolivia: 'BO', 'brunei': 'BN',
  'st. lucia': 'LC', 'trinidad and tobago': 'TT', 'united arab emirates': 'AE', 'saudi arabia': 'SA', 'new zealand': 'NZ', israel: 'IL', 'south africa': 'ZA',
};
let nameIndex: Map<string, string> | null = null;
/** Two-letter code for a Census country or ACS birthplace name, or null when it cannot be matched to exactly one country. */
export function nameToIso2(raw: string): string | null {
  if (!nameIndex) {
    nameIndex = new Map();
    for (const [code, name] of Object.entries({ ...COUNTRY_LABELS, ...NAMES_THE_TEXT_EXTRACTOR_SKIPS })) nameIndex.set(name.toLowerCase(), code);
  }
  const key = raw.trim().toLowerCase();
  const direct = CENSUS_ALIASES[key] ?? nameIndex.get(key);
  if (direct) return direct;
  const hits = extractCountries(raw);
  return hits.length === 1 ? hits[0] : null;
}

/** A Census partner row is a country when its code is four digits and it is not a regional or other grouping (those end in 000 or 0). */
const isPartnerCode = (code: string) => /^\d{4}$/.test(code) && !/000$/.test(code);

/**
 * Sum the HS-chapter rows of one month into one row per partner country. `table` is the API's array-of-arrays response. Rows flagged as
 * a country grouping, rows for regions, and the all-countries "-" row are dropped so the total is the sum of real partners.
 * `valueColumn` is CON_VAL_MO for imports and ALL_VAL_MO for exports; `dutyColumn` only for imports.
 */
export function aggregatePartners(table: unknown, valueColumn: string, dutyColumn?: string): Map<string, PartnerMonth> {
  const out = new Map<string, PartnerMonth>();
  if (!Array.isArray(table) || table.length < 2 || !Array.isArray(table[0])) return out;
  const head = table[0] as string[];
  const at = (n: string) => head.indexOf(n);
  const iCode = at('CTY_CODE'), iName = at('CTY_NAME'), iVal = at(valueColumn), iDut = dutyColumn ? at(dutyColumn) : -1, iLvl = at('SUMMARY_LVL'), iComm = at('COMM_LVL');
  if (iCode < 0 || iName < 0 || iVal < 0 || (dutyColumn && iDut < 0)) throw new Error(`Census response lacks an expected column (${head.join(',')})`);
  for (const row of table.slice(1) as string[][]) {
    if (iLvl >= 0 && row[iLvl] && row[iLvl] !== 'DET') continue;
    if (iComm >= 0 && row[iComm] && row[iComm] !== 'HS2') continue;
    const code = String(row[iCode] ?? '').trim();
    if (!isPartnerCode(code)) continue;
    const value = Number(row[iVal]);
    const duties = iDut >= 0 ? Number(row[iDut]) : 0;
    if (!Number.isFinite(value) || (iDut >= 0 && !Number.isFinite(duties))) continue;
    const cur = out.get(code) ?? { code, name: String(row[iName] ?? '').trim(), value: 0, duties: 0 };
    cur.value += value;
    cur.duties += duties;
    out.set(code, cur);
  }
  return out;
}

/** Months 'YYYY-MM' from `from` to `to` inclusive. */
export function monthRange(from: string, to: string): string[] {
  const out: string[] = [];
  let [y, m] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/** What to fetch this run: the newest stored month again (Census revises it), then missing months newest first, within the budget. */
export function planMonths(stored: Set<string>, latestStored: string | null, today: Date, maxMonths: number): string[] {
  const last = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1)).toISOString().slice(0, 7);
  const missing = monthRange(FIRST_MONTH, last).filter((ym) => !stored.has(ym)).reverse();
  const plan = latestStored ? [latestStored, ...missing] : missing;
  return plan.slice(0, maxMonths);
}

// --- Trade job ---
export interface TradeMonthRows {
  ym: string;
  kind: 'imports' | 'exports';
  partners: Map<string, PartnerMonth>;
}

function censusUrl(kind: 'imports' | 'exports', ym: string, key: string): string {
  const get = kind === 'imports' ? 'CTY_CODE,CTY_NAME,CON_VAL_MO,CAL_DUT_MO,SUMMARY_LVL,COMM_LVL' : 'CTY_CODE,CTY_NAME,ALL_VAL_MO,SUMMARY_LVL,COMM_LVL';
  return `${TRADE_BASE}/${kind}/hs?get=${get}&time=${ym}&COMM_LVL=HS2&key=${encodeURIComponent(key)}`;
}

/** Fetch one month. Null means Census has not published that month (HTTP 204 / empty body). */
async function fetchMonth(kind: 'imports' | 'exports', ym: string, key: string): Promise<Map<string, PartnerMonth> | null> {
  const res = await fetch(censusUrl(kind, ym, key), { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 204 || res.status === 404) return null;
  // A bad key makes Census answer with an HTML page (or a redirect), never JSON.
  if (!res.ok) throw new Error(`Census ${kind} ${ym} failed: HTTP ${res.status}${res.status === 400 || res.status === 403 || res.status === 302 ? ' (check CENSUS_API_KEY)' : ''}`);
  const text = await res.text();
  if (!text.trim()) return null;
  let table: unknown;
  try {
    table = JSON.parse(text);
  } catch {
    throw new Error(`Census ${kind} ${ym} did not return JSON (is CENSUS_API_KEY valid and activated? the key e-mail has an activation link)`);
  }
  const parts = kind === 'imports' ? aggregatePartners(table, 'CON_VAL_MO', 'CAL_DUT_MO') : aggregatePartners(table, 'ALL_VAL_MO');
  return parts.size === 0 ? null : parts;
}

/** Upsert statements for one month. Only changed values are written (WHERE ... IS NOT excluded...). */
export function tradeStatements(m: TradeMonthRows): string[] {
  const rows: string[] = [];
  let tv = 0, td = 0;
  for (const p of m.partners.values()) {
    tv += p.value;
    td += p.duties;
    const iso = nameToIso2(p.name);
    rows.push(m.kind === 'imports'
      ? `(${sqlString(m.ym)}, ${sqlString(p.code)}, ${sqlString(p.name)}, ${sqlString(iso)}, ${p.value}, ${p.duties}, NULL)`
      : `(${sqlString(m.ym)}, ${sqlString(p.code)}, ${sqlString(p.name)}, ${sqlString(iso)}, NULL, NULL, ${p.value})`);
  }
  rows.push(m.kind === 'imports' ? `(${sqlString(m.ym)}, 'ALL', 'All partners', NULL, ${tv}, ${td}, NULL)` : `(${sqlString(m.ym)}, 'ALL', 'All partners', NULL, NULL, NULL, ${tv})`);
  const prefix = 'INSERT INTO census_trade (ym, cty_code, cty_name, iso2, imports, duties, exports) VALUES';
  const suffix =
    m.kind === 'imports'
      ? `ON CONFLICT(ym, cty_code) DO UPDATE SET imports = excluded.imports, duties = excluded.duties, cty_name = excluded.cty_name, iso2 = excluded.iso2
         WHERE census_trade.imports IS NOT excluded.imports OR census_trade.duties IS NOT excluded.duties`
      : `ON CONFLICT(ym, cty_code) DO UPDATE SET exports = excluded.exports WHERE census_trade.exports IS NOT excluded.exports`;
  return buildInsertStatements(prefix, rows, 200, suffix);
}

const STATUS_KEY = 'census_trade';
async function setStatus(env: Env, note: string, success: boolean): Promise<void> {
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO pulse_feed_state (source_key, last_attempt_at, last_success_at, last_note) VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(source_key) DO UPDATE SET last_attempt_at = excluded.last_attempt_at, last_success_at = COALESCE(excluded.last_success_at, pulse_feed_state.last_success_at), last_note = excluded.last_note
     WHERE pulse_feed_state.last_note IS NOT excluded.last_note OR excluded.last_success_at IS NOT NULL`
  )
    .bind(STATUS_KEY, now, success ? now : null, note)
    .run()
    .catch(() => undefined);
}

export async function refreshCensusTrade(env: Env, now = new Date()): Promise<RefreshResult> {
  const key = env.CENSUS_API_KEY;
  if (!key) {
    await setStatus(env, NEEDS_KEY, false);
    return { source: 'census_trade', rows: 0, skipped: NEEDS_KEY };
  }
  const have = await env.DB.prepare(
    `SELECT ym, SUM(imports IS NOT NULL) AS i, SUM(exports IS NOT NULL) AS e FROM census_trade WHERE cty_code = 'ALL' GROUP BY ym`
  ).all<{ ym: string; i: number; e: number }>();
  const haveImports = new Set(have.results.filter((r) => r.i > 0).map((r) => r.ym));
  const haveExports = new Set(have.results.filter((r) => r.e > 0).map((r) => r.ym));
  const latest = (s: Set<string>) => [...s].sort().at(-1) ?? null;
  // Two requests per month (imports and exports); leave room for the population job's three.
  const perKind = Math.floor((MAX_REQUESTS - 3) / 2);
  const plan: [TradeMonthRows['kind'], string][] = [
    ...planMonths(haveImports, latest(haveImports), now, perKind).map((ym) => ['imports', ym] as [TradeMonthRows['kind'], string]),
    ...planMonths(haveExports, latest(haveExports), now, perKind).map((ym) => ['exports', ym] as [TradeMonthRows['kind'], string]),
  ];
  const statements: string[] = [];
  let months = 0;
  let blocked = 0;
  const errors: string[] = [];
  for (const [kind, ym] of plan) {
    try {
      const partners = await fetchMonth(kind, ym, key);
      if (!partners) {
        blocked++;
        continue;
      }
      statements.push(...tradeStatements({ ym, kind, partners }));
      months++;
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
      break; // a bad key or an outage will fail every month the same way
    }
  }
  if (statements.length > 0) await env.DB.batch(statements.map((s) => env.DB.prepare(s)));
  if (errors.length > 0 && months === 0) {
    await setStatus(env, errors[0], false);
    throw new Error(errors[0]);
  }
  const note = `Loaded ${months} month-series${blocked ? `; ${blocked} not published yet` : ''}${errors.length ? `; stopped early: ${errors[0]}` : ''}.`;
  await setStatus(env, note, true);
  return { source: 'census_trade', rows: months };
}

// --- ACS B05006: foreign-born population by country of birth ---
export const ACS_STATUS_KEY = 'acs_b05006';

export interface AcsVar {
  id: string;
  iso2: string;
}

/** From the group's variables.json: the estimate variables that are a single country of birth. */
export function acsCountryVariables(groupJson: unknown): AcsVar[] {
  const vars = (groupJson as { variables?: Record<string, { label?: string }> } | null)?.variables;
  if (!vars) throw new Error('ACS B05006 group file has no variables');
  const out: AcsVar[] = [];
  for (const [id, v] of Object.entries(vars)) {
    if (!/^B05006_\d+E$/.test(id) || !v.label) continue;
    const parts = v.label.replace(/^Estimate!!/, '').split('!!');
    const last = parts[parts.length - 1];
    let iso: string | null = null;
    if (/^United Kingdom \(inc\. Crown Dependencies\):$/.test(last)) iso = 'GB';
    else if (/^China, excluding Hong Kong and Taiwan$/.test(last)) iso = 'CN';
    else if (!last.endsWith(':') && !/Other |n\.e\.c\.|Azores|England|Scotland|excluding England|West Indies|Czechoslovakia|Micronesia/.test(last) && parts.length >= 3) iso = nameToIso2(last);
    if (iso) out.push({ id, iso2: iso });
  }
  // One variable per country: the first wins if two names map to the same code (e.g. Congo variants).
  const seen = new Set<string>();
  return out.filter((v) => (seen.has(v.iso2) ? false : (seen.add(v.iso2), true))).sort((a, b) => a.id.localeCompare(b.id));
}

export interface AcsRow {
  geo: string; // 'US' or state name
  iso2: string;
  estimate: number;
}

/** `table` is the API's array-of-arrays answer for `get=NAME,group(B05006)&for=state:*` (or `us:1`). */
export function parseAcsRows(table: unknown, vars: AcsVar[]): AcsRow[] {
  if (!Array.isArray(table) || table.length < 2) return [];
  const head = table[0] as string[];
  const iName = head.indexOf('NAME');
  if (iName < 0) throw new Error('ACS response has no NAME column');
  const cols = vars.map((v) => ({ iso2: v.iso2, i: head.indexOf(v.id) })).filter((c) => c.i >= 0);
  const out: AcsRow[] = [];
  for (const row of table.slice(1) as (string | null)[][]) {
    const name = String(row[iName] ?? '');
    const geo = name === 'United States' ? 'US' : name;
    if (!geo || geo === 'Puerto Rico') continue;
    for (const c of cols) {
      const n = Number(row[c.i]);
      if (Number.isFinite(n) && n > 0) out.push({ geo, iso2: c.iso2, estimate: Math.round(n) });
    }
  }
  return out;
}

export function acsStatements(year: number, rows: AcsRow[]): string[] {
  return buildInsertStatements(
    'INSERT INTO acs_foreign_born (year, geo, iso2, estimate) VALUES',
    rows.map((r) => `(${year}, ${sqlString(r.geo)}, ${sqlString(r.iso2)}, ${r.estimate})`),
    200,
    'ON CONFLICT(geo, iso2) DO UPDATE SET year = excluded.year, estimate = excluded.estimate WHERE acs_foreign_born.year IS NOT excluded.year OR acs_foreign_born.estimate IS NOT excluded.estimate'
  );
}

export async function refreshAcsForeignBorn(env: Env, now = new Date()): Promise<RefreshResult> {
  const key = env.CENSUS_API_KEY;
  if (!key) return { source: 'census_acs', rows: 0, skipped: NEEDS_KEY };
  const stored = await env.DB.prepare(`SELECT MAX(year) AS y FROM acs_foreign_born`).first<{ y: number | null }>().catch(() => null);
  // The 1-year file for year N appears in September of N+1; ask for the newest one that could exist, once, until it is stored.
  const year = now.getUTCFullYear() - 1;
  if ((stored?.y ?? 0) >= year) return { source: 'census_acs', rows: 0, unchanged: true };
  const base = `https://api.census.gov/data/${year}/acs/acs1`;
  const group = await fetch(`${base}/groups/B05006.json`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (group.status === 404) return { source: 'census_acs', rows: 0, unchanged: true }; // this year's release is not out yet
  if (!group.ok) throw new Error(`ACS group file failed: HTTP ${group.status}`);
  const vars = acsCountryVariables(await group.json());
  const get = async (geography: string) => {
    const r = await fetch(`${base}?get=NAME,group(B05006)&for=${geography}&key=${encodeURIComponent(key)}`, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) throw new Error(`ACS B05006 ${geography} failed: HTTP ${r.status}${r.status === 400 || r.status === 403 ? ' (check CENSUS_API_KEY)' : ''}`);
    const text = await r.text();
    try {
      return parseAcsRows(JSON.parse(text), vars);
    } catch (err) {
      throw new Error(`ACS B05006 ${geography}: ${err instanceof Error ? err.message : 'not JSON'} (is CENSUS_API_KEY valid and activated?)`);
    }
  };
  const rows = [...(await get('us:1')), ...(await get('state:*'))];
  if (rows.length < 200) throw new Error(`ACS B05006 produced only ${rows.length} rows; the table layout may have changed`);
  await env.DB.batch(acsStatements(year, rows).map((s) => env.DB.prepare(s)));
  return { source: 'census_acs', rows: rows.length };
}

// --- Reads for the pages ---
export interface TradePoint {
  ym: string;
  imports: number | null;
  duties: number | null;
  exports: number | null;
}

export interface TrailingStats {
  /** Last month of the 12-month window, 'YYYY-MM'. */
  asOf: string;
  months: number;
  imports: number;
  duties: number;
  exports: number;
  /** Exports minus imports; negative is a deficit. */
  balance: number;
  /** Share of all U.S. imports from this partner, percent. Null for the all-partner total. */
  shareOfUsImportsPct: number | null;
  effectiveRatePct: number | null;
}

/** The newest month that has both imports and exports for all partners, and the 12 months ending there. */
export function trailingWindow(all: TradePoint[]): { asOf: string; months: string[] } | null {
  const complete = all.filter((r) => r.imports !== null && r.exports !== null).map((r) => r.ym).sort();
  const asOf = complete.at(-1);
  if (!asOf) return null;
  const [y, m] = asOf.split('-').map(Number);
  const first = new Date(Date.UTC(y, m - 12, 1)).toISOString().slice(0, 7);
  return { asOf, months: complete.filter((ym) => ym >= first) };
}

/** Twelve-month totals for one partner (or, with `isTotal`, for all partners) against the all-partner series. */
export function trailingStats(window: { asOf: string; months: string[] }, all: TradePoint[], rows: TradePoint[], isTotal = false): TrailingStats {
  const inWin = (r: TradePoint) => window.months.includes(r.ym);
  const sum = (list: TradePoint[], k: 'imports' | 'duties' | 'exports') => list.filter(inWin).reduce((n, r) => n + (r[k] ?? 0), 0);
  const imports = sum(rows, 'imports');
  const duties = sum(rows, 'duties');
  const exports = sum(rows, 'exports');
  const total = sum(all, 'imports');
  return {
    asOf: window.asOf,
    months: window.months.length,
    imports,
    duties,
    exports,
    balance: exports - imports,
    shareOfUsImportsPct: isTotal || total <= 0 ? null : Math.round((imports / total) * 1000) / 10,
    effectiveRatePct: effectiveRatePct(duties, imports),
  };
}
