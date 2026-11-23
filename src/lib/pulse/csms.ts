// CBP Cargo Systems Messaging Service (CSMS) bulletins, from CBP's official GovDelivery topic feed (topic USDHSCBP_3, the topic behind
// "Register for CSMS Messages" on cbp.gov/trade/automated/cargo-systems-messaging-service). Keyless. The feed carries the 25 newest
// bulletins with the full HTML body of each (about 365 KB), so only the title, number, date and link are read, and the messages are kept
// in one small row (pulse_feed_state) that is rewritten only when a bulletin is new. Programs are tagged from the title alone: a message
// whose title does not name a program is left untagged rather than guessed at.
import type { Env } from '../../types/env.js';
import type { RefreshResult } from '../refresh/types.js';
import { USER_AGENT } from '../refresh/userAgent.js';

export const CSMS_FEED_URL = 'https://public.govdelivery.com/topics/USDHSCBP_3/feed.rss';
export const CSMS_PAGE_URL = 'https://www.cbp.gov/trade/automated/cargo-systems-messaging-service';
export const CSMS_KEY = 'csms_messages';
const KEEP = 150;

export const CSMS_PROGRAMS = ['Section 232', 'Section 301', 'Section 338', 'IEEPA', 'AD/CVD', 'De minimis', 'Forced labor', 'ACE'] as const;
export type CsmsProgram = (typeof CSMS_PROGRAMS)[number];

export interface CsmsMessage {
  /** CSMS number, e.g. "70476863". */
  id: string;
  title: string;
  /** Publication date, YYYY-MM-DD (as the feed gives it, in U.S. Central time). */
  published: string;
  url: string;
  programs: CsmsProgram[];
}

const RULES: [CsmsProgram, RegExp][] = [
  ['Section 232', /section\s*232/i],
  ['Section 301', /section\s*301/i],
  ['Section 338', /section\s*338/i],
  ['IEEPA', /\bIEEPA\b|international emergency economic powers|reciprocal (tariff|duties|trade)/i],
  ['AD/CVD', /anti-?dumping|countervailing|\bAD\s*\/\s*CVD\b|\bADD\s*\/\s*CVD\b/i],
  ['De minimis', /de minimis/i],
  ['Forced labor', /forced labor|withhold release|\bUFLPA\b/i],
  ['ACE', /\bACE\b/],
];

export function tagPrograms(title: string): CsmsProgram[] {
  return RULES.filter(([, re]) => re.test(title)).map(([p]) => p);
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)));

const MONTHS: Record<string, string> = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
/** "Thu, 19 Nov 2026 09:43:26 -0600" -> "2026-11-19" (the date as written, no timezone shift). */
export function rssDate(s: string): string | null {
  const m = /(\d{1,2})\s+([A-Z][a-z]{2})\s+(\d{4})/.exec(s);
  return m && MONTHS[m[2]] ? `${m[3]}-${MONTHS[m[2]]}-${m[1].padStart(2, '0')}` : null;
}

/** Reads items without parsing the (huge) HTML bodies: only the fields before <description> are used. */
export function parseCsmsFeed(xml: string): CsmsMessage[] {
  const out: CsmsMessage[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1].replace(/<description>[\s\S]*?<\/description>/, '');
    const rawTitle = /<title>([\s\S]*?)<\/title>/.exec(block)?.[1];
    const link = /<link>([\s\S]*?)<\/link>/.exec(block)?.[1]?.trim();
    const pub = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(block)?.[1];
    if (!rawTitle || !link || !pub) continue;
    const title = decode(rawTitle).replace(/\s+/g, ' ').trim();
    const idm = /^CSMS\s*#\s*(\d+)\s*[-–—]\s*(.+)$/.exec(title);
    const published = rssDate(pub);
    if (!idm || !published || !/^https:\/\//.test(link)) continue;
    out.push({ id: idm[1], title: idm[2].trim(), published, url: link, programs: tagPrograms(idm[2]) });
  }
  return out;
}

/** Newest first, one entry per CSMS number, at most KEEP. */
export function mergeMessages(stored: CsmsMessage[], fresh: CsmsMessage[]): CsmsMessage[] {
  const byId = new Map<string, CsmsMessage>();
  for (const m of [...stored, ...fresh]) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) => (a.published === b.published ? (a.id < b.id ? 1 : -1) : a.published < b.published ? 1 : -1)).slice(0, KEEP);
}

export async function loadCsms(env: Env): Promise<{ asOf: string | null; items: CsmsMessage[] }> {
  const row = await env.DB.prepare(`SELECT last_success_at, last_note FROM pulse_feed_state WHERE source_key = ?1`)
    .bind(CSMS_KEY)
    .first<{ last_success_at: string | null; last_note: string | null }>()
    .catch(() => null);
  try {
    return { asOf: row?.last_success_at ?? null, items: row?.last_note ? (JSON.parse(row.last_note) as CsmsMessage[]) : [] };
  } catch {
    return { asOf: row?.last_success_at ?? null, items: [] };
  }
}

export async function refreshCsms(env: Env): Promise<RefreshResult> {
  const res = await fetch(CSMS_FEED_URL, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`CBP CSMS feed fetch failed: HTTP ${res.status}`);
  const fresh = parseCsmsFeed(await res.text());
  if (fresh.length < 5) throw new Error(`Only ${fresh.length} CSMS messages parsed; the feed layout may have changed`);
  const { items: stored } = await loadCsms(env);
  const json = JSON.stringify(mergeMessages(stored, fresh));
  // One small row (the as-of date moves every successful check).
  await env.DB.prepare(
    `INSERT INTO pulse_feed_state (source_key, last_success_at, last_note) VALUES (?1, ?2, ?3)
     ON CONFLICT(source_key) DO UPDATE SET last_success_at = excluded.last_success_at, last_note = excluded.last_note `
  )
    .bind(CSMS_KEY, new Date().toISOString(), json)
    .run();
  return { source: 'csms', rows: fresh.length };
}
