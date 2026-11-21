// In-Worker port of scripts/fetch-ofac-sdn.ts. This is the highest-priority job in the schedule (see src/scheduled.ts) -- a stale sanctions
// list is a real compliance risk, not just a data-freshness nicety, which is why OFAC's own guidance is to refresh at least daily.
//
// Why the old version never succeeded in production (as of 2026-11), and what this one does differently:
//  1. SDN.XML is about 30 MB and 19,600 entries. Reading it with one res.text() and one XMLParser.parse() builds the whole tree in memory, far past
//     the Worker's 128 MB limit. This version streams the body and parses one <sdnEntry> at a time.
//  2. The OFAC endpoint answers 302 to a short-lived presigned AWS GovCloud S3 URL. Each hop is now followed by hand and a failure names the hop,
//     with the legacy www.treasury.gov address tried as a fallback.
//  3. Replacing the whole table writes about 44,000 rows plus index and search entries, more than a day of the free D1 write allowance. This
//     version compares each entry with what is stored (by uid) and writes only new, changed and removed entries, normally a few hundred a week.
//  4. The unchanged check no longer hashes the whole file: the Publish_Date, Record_Count and Content-Length at the head of the file are enough.
//
// CPU caveat: parsing 30 MB is still the most CPU-intensive step in the refresh suite. On the Workers Free plan's tiny CPU budget it may still
// fail; if data_refresh_log shows a CPU or timeout error, run scripts/fetch-ofac-sdn.ts locally (see docs/OWNER-TODO.md) or use a paid plan.
import { XMLParser } from 'fast-xml-parser';
import type { Env } from '../../types/env.js';
import { normalizeNameString } from '../normalize.js';
import { sqlString, sqlJson, buildInsertStatements } from './sql.js';
import type { RefreshResult } from './types.js';
import { assertNotShrunk } from './guards.js';
import { changeGate } from './changeGate.js';

const SOURCE_URL = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML';
// The pre-2025 address; it now redirects to the same service, but a different first hop can succeed when the primary one fails.
const FALLBACK_URLS = ['https://www.treasury.gov/ofac/downloads/sdn.xml'];
import { USER_AGENT as UA } from './userAgent.js';

interface AkaItem {
  type?: string;
  category?: string;
  firstName?: string;
  lastName?: string;
}
interface AddressItem {
  address1?: string;
  address2?: string;
  city?: string;
  postalCode?: string;
  country?: string;
}
export interface SdnEntry {
  uid: number | string;
  firstName?: string;
  lastName: string;
  sdnType?: string;
  remarks?: string;
  programList?: { program: string | string[] };
  akaList?: { aka: AkaItem | AkaItem[] };
  addressList?: { address: AddressItem | AddressItem[] };
  dateOfBirthList?: { dateOfBirthItem: { dateOfBirth?: string } | { dateOfBirth?: string }[] };
  placeOfBirthList?: { placeOfBirthItem: { placeOfBirth?: string } | { placeOfBirth?: string }[] };
}

function asArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function fullName(first: string | undefined, last: string): string {
  return first ? `${first} ${last}`.trim() : last.trim();
}

/** The values stored for one entry, before SQL formatting. Both the incoming file and the stored rows are reduced to this shape to be compared. */
export interface SdnRecord {
  uid: string;
  name: string;
  type: string | null;
  programs: string; // JSON text
  dob: string | null;
  placeOfBirth: string | null;
  addresses: string; // JSON text
  remarks: string | null;
  aliases: { name: string; type: string | null }[];
}

export function toRecord(entry: SdnEntry): SdnRecord {
  const programs = asArray(entry.programList?.program);
  const addresses = asArray(entry.addressList?.address).map((a) => ({
    address: [a.address1, a.address2].filter(Boolean).join(', ') || null,
    city: a.city ?? null,
    postalCode: a.postalCode ?? null,
    country: a.country ?? null,
  }));
  const dob = asArray(entry.dateOfBirthList?.dateOfBirthItem).find((d) => d.dateOfBirth)?.dateOfBirth ?? null;
  const placeOfBirth = asArray(entry.placeOfBirthList?.placeOfBirthItem).find((p) => p.placeOfBirth)?.placeOfBirth ?? null;
  const aliases: SdnRecord['aliases'] = [];
  for (const aka of asArray(entry.akaList?.aka)) {
    const name = fullName(aka.firstName, aka.lastName ?? '');
    if (name) aliases.push({ name, type: aka.type ?? null });
  }
  return {
    uid: String(entry.uid),
    name: fullName(entry.firstName, entry.lastName),
    type: entry.sdnType ?? null,
    programs: JSON.stringify(programs ?? null),
    dob,
    placeOfBirth,
    addresses: JSON.stringify(addresses ?? null),
    remarks: entry.remarks ?? null,
    aliases,
  };
}

/** A short fingerprint of a record, equal for an incoming record and the same record read back from the database. */
export function recordSignature(r: SdnRecord): string {
  const text = JSON.stringify([r.uid, r.name, r.type, r.programs, r.dob, r.placeOfBirth, r.addresses, r.remarks, r.aliases.map((a) => `${a.name}\u0001${a.type ?? ''}`).sort()]);
  // cyrb53: a fast 53-bit hash, plenty for telling changed rows from unchanged ones.
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${text.length}:${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}`;
}

export interface SdnDelta {
  /** Stored row ids to delete (removed entries, and the old copy of changed ones). */
  removeIds: number[];
  /** Records to insert (new entries, and the new copy of changed ones). */
  insert: SdnRecord[];
  unchanged: number;
}

/** What to write so the table matches the incoming file: only entries that are new, changed or gone. */
export function planSdnDelta(stored: Map<string, { id: number; sig: string }>, incoming: SdnRecord[]): SdnDelta {
  const removeIds: number[] = [];
  const insert: SdnRecord[] = [];
  let unchanged = 0;
  const seen = new Set<string>();
  for (const rec of incoming) {
    seen.add(rec.uid);
    const old = stored.get(rec.uid);
    if (!old) insert.push(rec);
    else if (old.sig !== recordSignature(rec)) {
      removeIds.push(old.id);
      insert.push(rec);
    } else unchanged++;
  }
  for (const [uid, old] of stored) if (!seen.has(uid)) removeIds.push(old.id);
  return { removeIds, insert, unchanged };
}

/** Follows OFAC's redirect by hand (it points at a presigned S3 URL) and falls back to the legacy address. */
async function openSdn(): Promise<Response> {
  const errors: string[] = [];
  for (const url of [SOURCE_URL, ...FALLBACK_URLS]) {
    const host = new URL(url).host;
    try {
      let res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'manual' });
      for (let hop = 1; hop <= 3 && res.status >= 300 && res.status < 400; hop++) {
        const location = res.headers.get('Location');
        if (!location) break;
        const next = new URL(location, url).toString();
        res = await fetch(next, { redirect: 'manual' }); // presigned URL: no extra headers
        if (!res.ok && !(res.status >= 300 && res.status < 400)) errors.push(`${new URL(next).host} (redirect hop ${hop}): HTTP ${res.status}`);
      }
      if (res.ok) return res;
      if (res.status >= 300 && res.status < 400) errors.push(`${host}: redirect without a usable Location`);
      else if (!errors.some((e) => e.includes(`HTTP ${res.status}`))) errors.push(`${host}: HTTP ${res.status}`);
    } catch (err) {
      errors.push(`${host}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`OFAC SDN fetch failed: ${errors.join('; ')}`);
}

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  isArray: (name) => ['sdnEntry', 'program', 'aka', 'address', 'dateOfBirthItem', 'placeOfBirthItem', 'id'].includes(name),
});

/** Streams the response and yields each <sdnEntry> as parsed; also reports the header's publish date and record count. Never holds the whole file. */
export async function* streamEntries(res: Response, onHeader: (h: { publishDate: string | null; recordCount: number | null }) => Promise<boolean>): AsyncGenerator<SdnEntry> {
  if (!res.body) throw new Error('OFAC SDN response had no body');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let headerDone = false;
  const END = '</sdnEntry>';
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf += decoder.decode(value, { stream: true });
    if (done) buf += decoder.decode();
    if (!headerDone && (buf.includes('<sdnEntry>') || done)) {
      headerDone = true;
      const publishDate = /<Publish_Date>([^<]*)<\/Publish_Date>/.exec(buf)?.[1] ?? null;
      const count = /<Record_Count>(\d+)<\/Record_Count>/.exec(buf)?.[1];
      if (!(await onHeader({ publishDate, recordCount: count ? Number(count) : null }))) {
        await reader.cancel();
        return;
      }
    }
    if (headerDone) {
      let end: number;
      while ((end = buf.indexOf(END)) !== -1) {
        const start = buf.indexOf('<sdnEntry>');
        const piece = buf.slice(start, end + END.length);
        buf = buf.slice(end + END.length);
        const parsed = parser.parse(`<sdnList>${piece}</sdnList>`).sdnList?.sdnEntry as SdnEntry[] | undefined;
        if (parsed?.[0]) yield parsed[0];
      }
    }
    if (done) return;
  }
}

async function loadStored(env: Env): Promise<{ stored: Map<string, { id: number; sig: string }>; maxId: number; maxAliasId: number }> {
  const aliasesById = new Map<number, { name: string; type: string | null }[]>();
  let maxAliasId = 0;
  for (let after = 0; ; ) {
    const { results } = await env.DB.prepare('SELECT id, sdn_id, alias, alias_type FROM sdn_aliases WHERE id > ?1 ORDER BY id LIMIT 8000')
      .bind(after)
      .all<{ id: number; sdn_id: number; alias: string; alias_type: string | null }>();
    for (const r of results) {
      const list = aliasesById.get(r.sdn_id) ?? [];
      list.push({ name: r.alias, type: r.alias_type });
      aliasesById.set(r.sdn_id, list);
      maxAliasId = Math.max(maxAliasId, r.id);
    }
    if (results.length < 8000) break;
    after = results[results.length - 1].id;
  }
  const stored = new Map<string, { id: number; sig: string }>();
  let maxId = 0;
  for (let after = 0; ; ) {
    const { results } = await env.DB.prepare(
      'SELECT id, uid, primary_name, entity_type, programs, dob, place_of_birth, addresses, remarks FROM sdn_entries WHERE id > ?1 ORDER BY id LIMIT 4000'
    )
      .bind(after)
      .all<{ id: number; uid: string; primary_name: string; entity_type: string | null; programs: string | null; dob: string | null; place_of_birth: string | null; addresses: string | null; remarks: string | null }>();
    for (const r of results) {
      stored.set(r.uid, {
        id: r.id,
        sig: recordSignature({
          uid: r.uid,
          name: r.primary_name,
          type: r.entity_type,
          programs: r.programs ?? 'null',
          dob: r.dob,
          placeOfBirth: r.place_of_birth,
          addresses: r.addresses ?? 'null',
          remarks: r.remarks,
          aliases: aliasesById.get(r.id) ?? [],
        }),
      });
      maxId = Math.max(maxId, r.id);
    }
    if (results.length < 4000) break;
    after = results[results.length - 1].id;
  }
  return { stored, maxId, maxAliasId };
}

export async function refreshSdn(env: Env): Promise<RefreshResult> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await openSdn();
  const contentLength = res.headers.get('Content-Length') ?? '';

  const state: { gate: Awaited<ReturnType<typeof changeGate>> | null; declaredCount: number | null } = { gate: null, declaredCount: null };
  const records: SdnRecord[] = [];
  for await (const entry of streamEntries(res, async (h) => {
    state.declaredCount = h.recordCount;
    state.gate = await changeGate(env, 'sdn', `${h.publishDate ?? ''}|${h.recordCount ?? ''}|${contentLength}`);
    return !state.gate.unchanged;
  })) {
    records.push(toRecord(entry));
  }
  const gate = state.gate;
  if (!gate) throw new Error('OFAC SDN response was empty or not the expected XML');
  if (gate.unchanged) return { source: 'sdn', rows: 0, unchanged: true };
  if (records.length === 0) {
    throw new Error('OFAC SDN refresh parsed zero entries -- aborting without touching sdn_entries/sdn_aliases');
  }
  if (state.declaredCount !== null && records.length < state.declaredCount * 0.99) {
    throw new Error(`OFAC SDN refresh read ${records.length} entries but the file declares ${state.declaredCount} -- the download was cut short; aborting without touching the live table`);
  }

  await assertNotShrunk(env, 'sdn', records.length);
  const { stored, maxId, maxAliasId } = await loadStored(env);
  const delta = planSdnDelta(stored, records);

  let entryId = maxId + 1;
  let aliasId = maxAliasId + 1;
  const entryRows: string[] = [];
  const aliasRows: string[] = [];
  for (const r of delta.insert) {
    const id = entryId++;
    entryRows.push(
      `(${id}, ${sqlString(r.uid)}, ${sqlString(r.name)}, ${sqlString(normalizeNameString(r.name))}, ` +
        `${sqlString(r.type)}, ${sqlString(r.programs)}, ${sqlString(r.dob)}, ${sqlString(r.placeOfBirth)}, ` +
        `${sqlString(r.addresses)}, ${sqlString(r.remarks)}, ${sqlString(SOURCE_URL)}, 1, ${sqlString(today)})`
    );
    for (const a of r.aliases) {
      aliasRows.push(`(${aliasId++}, ${id}, ${sqlString(a.name)}, ${sqlString(normalizeNameString(a.name))}, ${sqlString(a.type)})`);
    }
  }

  const deletes: string[] = [];
  for (let i = 0; i < delta.removeIds.length; i += 400) {
    const ids = delta.removeIds.slice(i, i + 400).join(',');
    deletes.push(`DELETE FROM sdn_aliases WHERE sdn_id IN (${ids});`, `DELETE FROM sdn_entries WHERE id IN (${ids});`);
  }
  const entryStatements = buildInsertStatements(
    `INSERT INTO sdn_entries (id, uid, primary_name, name_normalized, entity_type, programs, dob, place_of_birth, addresses, remarks, source_url, source_tier, last_updated) VALUES`,
    entryRows,
    150
  );
  const aliasStatements = buildInsertStatements(`INSERT INTO sdn_aliases (id, sdn_id, alias, alias_normalized, alias_type) VALUES`, aliasRows, 300);

  // Aliases have a FOREIGN KEY on entries -- delete aliases first (the statements above are ordered that way), insert entries before aliases,
  // all inside one atomic batch (see hts.ts header). A load with nothing to write still commits the fingerprint below.
  const statements = [...deletes, ...entryStatements, ...aliasStatements];
  if (statements.length > 0) await env.DB.batch(statements.map((s) => env.DB.prepare(s)));

  await gate.commit(records.length);
  return { source: 'sdn', rows: delta.insert.length + aliasRows.length + delta.removeIds.length };
}
