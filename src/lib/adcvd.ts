// Antidumping and countervailing duty (AD/CVD) orders in force, matched conservatively to an HTS line and an origin country.
//
// Where the data comes from, and why this ships empty. Every official source was checked on 2026-11-22:
//   - USITC "AD/CVD orders in effect" spreadsheet (usitc.gov/trade_remedy/documents/orders.xls): answers HTTP 403 "Access Denied" to automated requests.
//   - CBP's AD/CVD data (the ACE "ES-105 Active Case" report, and the public portal's service behind trade.cbp.dhs.gov): needs a login. CBP's data.gov
//     record "CBP Active Dumping and Active Countervailing (AD/CVD) Cases" has no file attached (last modified 2022).
//   - ITA ACCESS (access.trade.gov/adcvd) is an interactive application with no download or API; data.commerce.gov answers with a bot challenge;
//     the Federal Register refuses automated requests.
// None of these is worked around. The table (migration 0110) therefore starts empty and the pages say "order data not loaded". When the owner saves
// an official export (ITA ACCESS "AD/CVD Search" results, or the USITC orders spreadsheet) as CSV, `scripts/build-adcvd.ts` turns it into the
// migration that fills the table; nothing else changes.
import type { Env } from '../types/env.js';
import { parseCsvLine } from './refresh/csv.js';
import { sqlString } from './refresh/sql.js';

export interface AdcvdOrder {
  case_number: string;
  order_type: 'AD' | 'CVD';
  country_code: string;
  country: string;
  product: string;
  order_date: string | null;
  rate_min: number | null;
  rate_max: number | null;
  hts_prefixes: string | null;
  chapters: string | null;
  source: string;
  source_url: string;
  as_of: string;
}

export interface AdcvdMatch extends Pick<AdcvdOrder, 'case_number' | 'order_type' | 'country' | 'product' | 'order_date' | 'rate_min' | 'rate_max' | 'source_url'> {
  /** 'hts': the order names an HTS prefix this code falls under. 'keyword': only the product words (and chapter) overlap, so it needs a human check. */
  basis: 'hts' | 'keyword';
}

export const ADCVD_CSV_COLUMNS = ['case_number', 'country_code', 'country', 'product', 'order_date', 'rate_min', 'rate_max', 'hts_prefixes', 'chapters', 'source_url'];

const num = (s: string | undefined): number | null => {
  const t = (s ?? '').replace(/[%\s,]/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** The case-number letter gives the type: A- antidumping, C- countervailing. Anything else is skipped rather than guessed. */
export function parseAdcvdCsv(text: string, meta: { source: string; asOf: string; defaultUrl: string }): AdcvdOrder[] {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const head = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  for (const need of ['case_number', 'country_code', 'product']) if (!head.includes(need)) throw new Error(`CSV is missing the "${need}" column (expected: ${ADCVD_CSV_COLUMNS.join(', ')})`);
  const out: AdcvdOrder[] = [];
  const seen = new Set<string>();
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const get = (name: string) => (cells[head.indexOf(name)] ?? '').trim();
    const caseNo = get('case_number').toUpperCase();
    const type = /^A-\d{3}-\d{3}$/.test(caseNo) ? 'AD' : /^C-\d{3}-\d{3}$/.test(caseNo) ? 'CVD' : null;
    const cc = get('country_code').toUpperCase();
    const product = get('product');
    if (!type || !/^[A-Z]{2}$/.test(cc) || !product || seen.has(caseNo)) continue;
    seen.add(caseNo);
    const date = get('order_date');
    const prefixes = get('hts_prefixes').split(/[,;|\s]+/).map((p) => p.replace(/\D/g, '')).filter((p) => p.length >= 4);
    const chapters = get('chapters').split(/[,;|\s]+/).map((c) => c.replace(/\D/g, '').padStart(2, '0')).filter((c) => c.length === 2 && c !== '00');
    out.push({
      case_number: caseNo,
      order_type: type,
      country_code: cc,
      country: get('country') || cc,
      product,
      order_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
      rate_min: num(get('rate_min')),
      rate_max: num(get('rate_max')),
      hts_prefixes: prefixes.length ? prefixes.join(',') : null,
      chapters: chapters.length ? chapters.join(',') : null,
      source: meta.source,
      source_url: get('source_url') || meta.defaultUrl,
      as_of: meta.asOf,
    });
  }
  return out;
}

/** The SQL that replaces the table's contents with these orders (used by scripts/build-adcvd.ts for a numbered migration). */
export function adcvdMigrationSql(orders: AdcvdOrder[]): string {
  const cols = 'case_number, order_type, country_code, country, product, order_date, rate_min, rate_max, hts_prefixes, chapters, source, source_url, as_of';
  const values = orders.map(
    (o) =>
      `(${[o.case_number, o.order_type, o.country_code, o.country, o.product, o.order_date, o.rate_min, o.rate_max, o.hts_prefixes, o.chapters, o.source, o.source_url, o.as_of].map((v) => sqlString(v)).join(', ')})`
  );
  return `DELETE FROM adcvd_orders;\n${values.length ? `INSERT INTO adcvd_orders (${cols}) VALUES\n${values.join(',\n')};\n` : ''}`;
}

const STOP = new Set(['and', 'the', 'for', 'with', 'from', 'other', 'others', 'not', 'than', 'having', 'each', 'whether', 'only', 'etc', 'including', 'products', 'product', 'articles', 'parts', 'made', 'nesoi', 'similar']);
const words = (s: string): Set<string> =>
  new Set((s.toLowerCase().match(/[a-z]{4,}/g) ?? []).map((w) => w.replace(/ies$/, 'y').replace(/(es|s)$/, '')).filter((w) => !STOP.has(w)));

/**
 * Orders that may apply to this HTS code from this country. Conservative on purpose: a country mismatch never matches; an order that names HTS prefixes
 * matches only when the code starts with one of them; an order that names no prefixes matches only when its chapter list (when it has one) includes the
 * code's chapter AND the product words overlap the HTS description. Keyword matches are labeled so, and the page says to verify.
 */
export function matchAdcvdOrders(orders: AdcvdOrder[], hts: string, countryCode: string, description: string): AdcvdMatch[] {
  const digits = hts.replace(/\D/g, '');
  const chapter = digits.slice(0, 2);
  const desc = words(description);
  const out: AdcvdMatch[] = [];
  for (const o of orders) {
    if (o.country_code !== countryCode.toUpperCase()) continue;
    let basis: AdcvdMatch['basis'] | null = null;
    if (o.hts_prefixes) {
      if (o.hts_prefixes.split(',').some((p) => digits.startsWith(p) || (digits.length >= 4 && p.startsWith(digits)))) basis = 'hts';
    } else {
      const chapterOk = o.chapters ? o.chapters.split(',').includes(chapter) : true;
      const overlap = [...words(o.product)].some((w) => desc.has(w));
      if (chapterOk && overlap) basis = 'keyword';
    }
    if (basis) {
      out.push({ case_number: o.case_number, order_type: o.order_type, country: o.country, product: o.product, order_date: o.order_date, rate_min: o.rate_min, rate_max: o.rate_max, source_url: o.source_url, basis });
    }
  }
  return out.sort((a, b) => (a.basis === b.basis ? a.case_number.localeCompare(b.case_number) : a.basis === 'hts' ? -1 : 1)).slice(0, 25);
}

export interface AdcvdResult {
  status: 'ok' | 'not_loaded';
  asOf: string | null;
  source: string | null;
  matches: AdcvdMatch[];
  searchUrl: string;
  note: string;
}

export const ADCVD_SEARCH_URL = 'https://access.trade.gov/adcvd';
export const ADCVD_NOTE =
  'Antidumping and countervailing duty orders may apply: verify with the Commerce Department (ITA ACCESS) and CBP before you ship. Orders are matched by HTS code where the source names one and otherwise by product words, so a match is a lead, not a finding, and a missing match is not proof that no order applies.';

export async function loadAdcvdMatches(env: Env, hts: string, countryCode: string, description: string): Promise<AdcvdResult> {
  const base = { searchUrl: ADCVD_SEARCH_URL, note: ADCVD_NOTE };
  try {
    const total = await env.DB.prepare(`SELECT COUNT(*) AS n, MAX(as_of) AS as_of, MIN(source) AS source FROM adcvd_orders`).first<{ n: number; as_of: string | null; source: string | null }>();
    if (!total || total.n === 0) return { ...base, status: 'not_loaded', asOf: null, source: null, matches: [] };
    const { results } = await env.DB.prepare(`SELECT * FROM adcvd_orders WHERE country_code = ?1`).bind(countryCode.toUpperCase()).all<AdcvdOrder>();
    return { ...base, status: 'ok', asOf: total.as_of, source: total.source, matches: matchAdcvdOrders(results, hts, countryCode, description) };
  } catch {
    return { ...base, status: 'not_loaded', asOf: null, source: null, matches: [] };
  }
}
