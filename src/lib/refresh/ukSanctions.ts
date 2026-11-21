// UK Sanctions List, published by the FCDO. The OFSI Consolidated List (ConList.xml) closed on 2026-01-28 and its storage account now refuses
// public access (HTTP 409), so this job reads the UK Sanctions List XML instead:
//   https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml  (public, no key; about 22 MB, about 6,400 designations; also .csv)
// Each <Designation> is one real-world designation with its names (one primary, the rest aliases), regime, sanctions imposed and statement of reasons.
// See migrations/0020_schema_uk_sanctions.sql's header for why this is a separate table from SDN/CSL/UN rather than tagged into any of them.
//
// The file is read as a stream, one <Designation> at a time, so the 22 MB document is never held as a parsed tree.
import type { Env } from '../../types/env.js';
import { normalizeNameString } from '../normalize.js';
import { sqlString, buildInsertStatements } from './sql.js';
import type { RefreshResult } from './types.js';
import { assertNotShrunk } from './guards.js';
import { changeGate } from './changeGate.js';
import { USER_AGENT as UA } from './userAgent.js';

const SOURCE_URL = 'https://sanctionslist.fcdo.gov.uk/docs/UK-Sanctions-List.xml';
const CITATION_URL = 'https://sanctionslist.fcdo.gov.uk';

function tagValue(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  if (!m) return null;
  const v = decodeXml(m[1]).replace(/\s+/g, ' ').trim();
  return v.length > 0 ? v : null;
}

function decodeXml(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

/** "20/11/2026" to "2026-11-20"; anything else is kept as is. */
function isoDate(d: string | null): string | null {
  const m = d ? /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(d) : null;
  return m ? `${m[3]}-${m[2]}-${m[1]}` : d;
}

export interface UkDesignation {
  uid: string;
  groupId: string | null;
  entityType: string;
  regimeName: string | null;
  listingType: string | null;
  dateListed: string | null;
  statementOfReasons: string | null;
  primaryName: string;
  aliases: { name: string; type: string | null }[];
  address: string | null;
}

function buildName(block: string): string {
  return ['Title', 'Name1', 'Name2', 'Name3', 'Name4', 'Name5', 'Name6'].map((t) => tagValue(block, t)).filter(Boolean).join(' ');
}

function buildAddress(block: string): string | null {
  const lines = ['AddressLine1', 'AddressLine2', 'AddressLine3', 'AddressLine4', 'AddressLine5', 'AddressLine6', 'AddressPostalCode', 'AddressCountry'].map((t) => tagValue(block, t));
  return lines.filter(Boolean).join(', ') || null;
}

export function parseDesignation(block: string): UkDesignation | null {
  const uid = tagValue(block, 'UniqueID');
  if (!uid) return null;
  const namesBlock = /<Names>([\s\S]*?)<\/Names>/.exec(block)?.[1] ?? '';
  const names = [...namesBlock.matchAll(/<Name>([\s\S]*?)<\/Name>/g)]
    .map((m) => ({ name: buildName(m[1]), type: tagValue(m[1], 'NameType') }))
    .filter((n) => n.name);
  if (names.length === 0) return null;
  const primary = names.find((n) => n.type?.toLowerCase() === 'primary name') ?? names[0];
  const addresses = [...block.matchAll(/<Address>([\s\S]*?)<\/Address>/g)].map((m) => buildAddress(m[1])).filter((a): a is string => !!a);
  return {
    uid,
    groupId: tagValue(block, 'OFSIGroupID'),
    entityType: tagValue(block, 'IndividualEntityShip') ?? 'Entity',
    regimeName: tagValue(block, 'RegimeName'),
    listingType: tagValue(block, 'DesignationSource'),
    dateListed: isoDate(tagValue(block, 'DateDesignated')),
    statementOfReasons: tagValue(block, 'UKStatementofReasons'),
    primaryName: primary.name,
    aliases: names.filter((n) => n !== primary && n.name !== primary.name).map((n) => ({ name: n.name, type: n.type })),
    address: addresses.slice(0, 3).join(' | ') || null,
  };
}

/** Yields each <Designation> block from a streamed body, and reports the DateGenerated header once. */
export async function* streamDesignations(body: ReadableStream<Uint8Array>, onHeader: (generated: string | null) => Promise<boolean>): AsyncGenerator<string> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let headerDone = false;
  const END = '</Designation>';
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buf += decoder.decode(value, { stream: true });
    if (done) buf += decoder.decode();
    if (!headerDone && (buf.includes('<Designation>') || done)) {
      headerDone = true;
      if (!(await onHeader(/<DateGenerated>([^<]*)<\/DateGenerated>/.exec(buf)?.[1] ?? null))) {
        await reader.cancel();
        return;
      }
    }
    if (headerDone) {
      let end: number;
      while ((end = buf.indexOf(END)) !== -1) {
        const start = buf.indexOf('<Designation>');
        yield buf.slice(start, end + END.length);
        buf = buf.slice(end + END.length);
      }
    }
    if (done) return;
  }
}

export async function refreshUkSanctions(env: Env): Promise<RefreshResult> {
  const res = await fetch(SOURCE_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok || !res.body) throw new Error(`UK sanctions list fetch failed: HTTP ${res.status}`);
  const fingerprint = `${res.headers.get('Last-Modified') ?? ''}|${res.headers.get('Content-Length') ?? ''}`;

  const state: { gate: Awaited<ReturnType<typeof changeGate>> | null } = { gate: null };
  const designations: UkDesignation[] = [];
  for await (const block of streamDesignations(res.body, async (generated) => {
    state.gate = await changeGate(env, 'uk_sanctions', `${fingerprint}|${generated ?? ''}`);
    return !state.gate.unchanged;
  })) {
    const d = parseDesignation(block);
    if (d) designations.push(d);
  }
  const g = state.gate;
  if (!g) throw new Error('UK sanctions list response did not look like the expected XML -- feed may have changed');
  if (g.unchanged) return { source: 'uk_sanctions', rows: 0, unchanged: true };
  if (designations.length === 0) {
    throw new Error('UK sanctions refresh produced zero entries -- aborting without touching uk_sanctions_entries/aliases');
  }

  const today = new Date().toISOString().slice(0, 10);
  let entryId = 1;
  let aliasId = 1;
  const entryRows: string[] = [];
  const aliasRows: string[] = [];
  for (const d of designations) {
    const id = entryId++;
    entryRows.push(
      `(${id}, ${sqlString(d.uid)}, ${sqlString(d.groupId)}, ${sqlString(d.entityType)}, ${sqlString(d.primaryName)}, ` +
        `${sqlString(normalizeNameString(d.primaryName))}, ${sqlString(d.regimeName)}, ${sqlString(d.listingType)}, ` +
        `${sqlString(d.dateListed)}, ${sqlString(d.address)}, ${sqlString(d.statementOfReasons)}, ` +
        `${sqlString(CITATION_URL)}, 1, ${sqlString(today)})`
    );
    for (const a of d.aliases) {
      aliasRows.push(`(${aliasId++}, ${id}, ${sqlString(a.name)}, ${sqlString(normalizeNameString(a.name))}, ${sqlString(a.type)})`);
    }
  }

  await assertNotShrunk(env, 'uk_sanctions', entryRows.length);
  const entryStatements = buildInsertStatements(
    `INSERT INTO uk_sanctions_entries (id, uid, group_id, entity_type, primary_name, name_normalized, regime_name, listing_type, date_listed, addresses, statement_of_reasons, source_url, source_tier, last_updated) VALUES`,
    entryRows,
    150
  );
  const aliasStatements = buildInsertStatements(`INSERT INTO uk_sanctions_aliases (id, uk_id, alias, alias_normalized, alias_type) VALUES`, aliasRows, 300);

  await env.DB.batch([
    env.DB.prepare('DELETE FROM uk_sanctions_aliases'),
    env.DB.prepare('DELETE FROM uk_sanctions_entries'),
    ...entryStatements.map((s) => env.DB.prepare(s)),
    ...aliasStatements.map((s) => env.DB.prepare(s)),
  ]);

  await g.commit(entryRows.length);
  return { source: 'uk_sanctions', rows: entryRows.length + aliasRows.length };
}
