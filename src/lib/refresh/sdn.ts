// In-Worker port of scripts/fetch-ofac-sdn.ts. This is the highest-priority
// job in the schedule (see src/scheduled.ts) -- a stale sanctions list is a
// real compliance risk, not just a data-freshness nicety, which is why OFAC's
// own guidance is to refresh at least daily.
//
// CPU-time caveat: XML parsing a multi-MB document is the most CPU-intensive
// step in this whole refresh suite. Cloudflare's Cron Trigger CPU-time budget
// is plan-dependent (as low as 10ms on the Workers Free plan, up to 30s on a
// paid Standard usage plan) -- if this job's D1_ERROR/timeout shows up in
// data_refresh_log, the account is very likely on a tier whose CPU budget
// this job doesn't fit; there's no in-Worker way to raise that limit, only to
// upgrade the plan or fall back to running scripts/fetch-ofac-sdn.ts manually.
import { XMLParser } from 'fast-xml-parser';
import type { Env } from '../../types/env.js';
import { normalizeNameString } from '../normalize.js';
import { sqlString, sqlJson, buildInsertStatements } from './sql.js';
import type { RefreshResult } from './types.js';

const SOURCE_URL = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML';
const UA = 'trade-compliance-copilot-research/1.0 (portfolio project data loader)';

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
interface SdnEntry {
  uid: number;
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

export async function refreshSdn(env: Env): Promise<RefreshResult> {
  const today = new Date().toISOString().slice(0, 10);

  const res = await fetch(SOURCE_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`OFAC SDN fetch failed: HTTP ${res.status}`);
  const xmlText = await res.text();

  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    isArray: (name) => ['sdnEntry', 'program', 'aka', 'address', 'dateOfBirthItem', 'placeOfBirthItem', 'id'].includes(name),
  });
  const doc = parser.parse(xmlText);
  const entries: SdnEntry[] = doc.sdnList.sdnEntry;
  if (!entries || entries.length === 0) {
    throw new Error('OFAC SDN refresh parsed zero entries -- aborting without touching sdn_entries/sdn_aliases');
  }

  let entryId = 1;
  let aliasId = 1;
  const entryRows: string[] = [];
  const aliasRows: string[] = [];

  for (const entry of entries) {
    const name = fullName(entry.firstName, entry.lastName);
    const programs = asArray(entry.programList?.program);
    const addresses = asArray(entry.addressList?.address).map((a) => ({
      address: [a.address1, a.address2].filter(Boolean).join(', ') || null,
      city: a.city ?? null,
      postalCode: a.postalCode ?? null,
      country: a.country ?? null,
    }));
    const dobs = asArray(entry.dateOfBirthList?.dateOfBirthItem);
    const dob = dobs.find((d) => d.dateOfBirth)?.dateOfBirth ?? null;
    const pobs = asArray(entry.placeOfBirthList?.placeOfBirthItem);
    const placeOfBirth = pobs.find((p) => p.placeOfBirth)?.placeOfBirth ?? null;

    const id = entryId++;
    entryRows.push(
      `(${id}, ${sqlString(String(entry.uid))}, ${sqlString(name)}, ${sqlString(normalizeNameString(name))}, ` +
        `${sqlString(entry.sdnType ?? null)}, ${sqlJson(programs)}, ${sqlString(dob)}, ${sqlString(placeOfBirth)}, ` +
        `${sqlJson(addresses)}, ${sqlString(entry.remarks ?? null)}, ${sqlString(SOURCE_URL)}, 1, ${sqlString(today)})`
    );

    for (const aka of asArray(entry.akaList?.aka)) {
      const akaName = fullName(aka.firstName, aka.lastName ?? '');
      if (!akaName) continue;
      aliasRows.push(
        `(${aliasId++}, ${id}, ${sqlString(akaName)}, ${sqlString(normalizeNameString(akaName))}, ${sqlString(aka.type ?? null)})`
      );
    }
  }

  const entryStatements = buildInsertStatements(
    `INSERT INTO sdn_entries (id, uid, primary_name, name_normalized, entity_type, programs, dob, place_of_birth, addresses, remarks, source_url, source_tier, last_updated) VALUES`,
    entryRows,
    150
  );
  const aliasStatements = buildInsertStatements(
    `INSERT INTO sdn_aliases (id, sdn_id, alias, alias_normalized, alias_type) VALUES`,
    aliasRows,
    300
  );

  // Aliases have a FOREIGN KEY on entries -- delete aliases first, insert
  // entries before aliases, all inside one atomic batch (see hts.ts header).
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sdn_aliases'),
    env.DB.prepare('DELETE FROM sdn_entries'),
    ...entryStatements.map((s) => env.DB.prepare(s)),
    ...aliasStatements.map((s) => env.DB.prepare(s)),
  ]);

  return { source: 'sdn', rows: entryRows.length + aliasRows.length };
}
