// Bulk-loads the full OFAC SDN list from the Sanctions List Service (primary
// official source: sanctionslistservice.ofac.treas.gov). The endpoint 302s to a
// signed S3 URL; Node's fetch follows redirects by default, so no special
// handling is needed beyond a browser-like User-Agent on the initial request.

import { mkdirSync, writeFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';
import { sqlString, sqlJson, buildBatchedInserts } from './lib/sql.js';
import { normalizeNameString } from '../src/lib/normalize.js';

const OUT_DIR = 'scripts/seed-sql/sdn';
const SOURCE_URL = 'https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.XML';
const TODAY = new Date().toISOString().slice(0, 10);
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

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Fetching ${SOURCE_URL} ...`);
  const res = await fetch(SOURCE_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`OFAC SDN fetch failed: HTTP ${res.status}`);
  const xmlText = await res.text();
  console.log(`Downloaded ${(xmlText.length / 1_000_000).toFixed(1)} MB, parsing...`);

  const parser = new XMLParser({
    ignoreAttributes: true,
    parseTagValue: false,
    isArray: (name) =>
      ['sdnEntry', 'program', 'aka', 'address', 'dateOfBirthItem', 'placeOfBirthItem', 'id'].includes(name),
  });
  const doc = parser.parse(xmlText);
  const entries: SdnEntry[] = doc.sdnList.sdnEntry;
  console.log(`Parsed ${entries.length} SDN entries.`);

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
        `${sqlJson(addresses)}, ${sqlString(entry.remarks ?? null)}, ${sqlString(SOURCE_URL)}, 1, ${sqlString(TODAY)})`
    );

    for (const aka of asArray(entry.akaList?.aka)) {
      const akaName = fullName(aka.firstName, aka.lastName ?? '');
      if (!akaName) continue;
      aliasRows.push(
        `(${aliasId++}, ${id}, ${sqlString(akaName)}, ${sqlString(normalizeNameString(akaName))}, ${sqlString(aka.type ?? null)})`
      );
    }
  }

  const entrySql = buildBatchedInserts(
    `INSERT INTO sdn_entries (id, uid, primary_name, name_normalized, entity_type, programs, dob, place_of_birth, addresses, remarks, source_url, source_tier, last_updated) VALUES`,
    entryRows,
    150
  );
  // "01-" prefix so this loads before aliases.sql when files are read in
  // alphabetical order (load-batches.ts) -- sdn_aliases has a FOREIGN KEY on
  // sdn_entries, which D1 enforces.
  writeFileSync(`${OUT_DIR}/01-entries.sql`, entrySql + '\n');

  const aliasSql = buildBatchedInserts(
    `INSERT INTO sdn_aliases (id, sdn_id, alias, alias_normalized, alias_type) VALUES`,
    aliasRows,
    300
  );
  writeFileSync(`${OUT_DIR}/02-aliases.sql`, aliasSql + '\n');

  console.log(`Done. ${entryRows.length} SDN entries, ${aliasRows.length} aliases -> ${OUT_DIR}/`);
  console.log(`Next: npm run seed:load-local  (or seed:load-remote)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
