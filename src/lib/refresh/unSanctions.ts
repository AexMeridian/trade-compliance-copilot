// UN Security Council Consolidated Sanctions List (scsanctions.un.org) --
// see migrations/0019_schema_un_sanctions.sql's header for why this is a
// separate table from SDN/CSL rather than tagged into either.
//
// SOURCE_PAGE's URL 302-redirects to a time-limited (1-hour) SAS-signed
// Azure blob URL that is regenerated on every request -- verified live, so
// this always fetches SOURCE_PAGE itself (fetch() follows the redirect)
// rather than caching/hardcoding the blob URL it resolves to.
//
// No library for XML in this Worker (same reasoning as wroFindings.ts's own
// CSV parser) -- small regex-based tag extraction instead, scoped to the
// exact fields this feed actually uses (verified against the live file).
import type { Env } from '../../types/env.js';
import { normalizeNameString } from '../normalize.js';
import { sqlString, buildInsertStatements } from './sql.js';
import type { RefreshResult } from './types.js';
import { changeGate } from './changeGate.js';

const SOURCE_PAGE = 'https://scsanctions.un.org/resources/xml/en/consolidated.xml';
const CITATION_URL = 'https://main.un.org/securitycouncil/en/content/un-sc-consolidated-list';
const UA = 'aex-terminal-research/1.0 (portfolio project data loader)';

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function tagValue(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  if (!m) return null;
  const v = decodeXmlEntities(m[1]).replace(/\s+/g, ' ').trim();
  return v.length > 0 ? v : null;
}

function tagBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g');
  const out: string[] = [];
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

interface ParsedRecord {
  dataId: string | null;
  entityType: 'individual' | 'entity';
  name: string;
  listType: string | null;
  referenceNumber: string | null;
  listedOn: string | null;
  nationality: string | null;
  addresses: string | null;
  remarks: string | null;
  aliases: { alias: string; aliasType: string | null }[];
}

function parseIndividual(block: string): ParsedRecord {
  const name = [tagValue(block, 'FIRST_NAME'), tagValue(block, 'SECOND_NAME'), tagValue(block, 'THIRD_NAME'), tagValue(block, 'FOURTH_NAME')]
    .filter(Boolean)
    .join(' ');

  const nationality =
    tagBlocks(block, 'NATIONALITY')
      .flatMap((n) => tagBlocks(n, 'VALUE').map((v) => decodeXmlEntities(v).trim()))
      .filter(Boolean)
      .join(', ') || null;

  const addresses =
    tagBlocks(block, 'INDIVIDUAL_ADDRESS')
      .map((a) => [tagValue(a, 'STREET'), tagValue(a, 'CITY'), tagValue(a, 'STATE_PROVINCE'), tagValue(a, 'COUNTRY'), tagValue(a, 'NOTE')].filter(Boolean).join(', '))
      .filter(Boolean)
      .join('; ') || null;

  const aliases = tagBlocks(block, 'INDIVIDUAL_ALIAS')
    .map((a) => ({ alias: tagValue(a, 'ALIAS_NAME'), aliasType: tagValue(a, 'QUALITY') }))
    .filter((a): a is { alias: string; aliasType: string | null } => !!a.alias);

  return {
    dataId: tagValue(block, 'DATAID'),
    entityType: 'individual',
    name,
    listType: tagValue(block, 'UN_LIST_TYPE'),
    referenceNumber: tagValue(block, 'REFERENCE_NUMBER'),
    listedOn: tagValue(block, 'LISTED_ON'),
    nationality,
    addresses,
    remarks: tagValue(block, 'COMMENTS1'),
    aliases,
  };
}

function parseEntity(block: string): ParsedRecord {
  // Entities only use FIRST_NAME (verified against the live file -- it holds
  // the full organization name, there is no SECOND_NAME/etc for ENTITY rows).
  const name = tagValue(block, 'FIRST_NAME') ?? '';

  const addresses =
    tagBlocks(block, 'ENTITY_ADDRESS')
      .map((a) => [tagValue(a, 'STREET'), tagValue(a, 'CITY'), tagValue(a, 'STATE_PROVINCE'), tagValue(a, 'COUNTRY'), tagValue(a, 'NOTE')].filter(Boolean).join(', '))
      .filter(Boolean)
      .join('; ') || null;

  const aliases = tagBlocks(block, 'ENTITY_ALIAS')
    .map((a) => ({ alias: tagValue(a, 'ALIAS_NAME'), aliasType: tagValue(a, 'QUALITY') }))
    .filter((a): a is { alias: string; aliasType: string | null } => !!a.alias);

  return {
    dataId: tagValue(block, 'DATAID'),
    entityType: 'entity',
    name,
    listType: tagValue(block, 'UN_LIST_TYPE'),
    referenceNumber: tagValue(block, 'REFERENCE_NUMBER'),
    listedOn: tagValue(block, 'LISTED_ON'),
    nationality: null,
    addresses,
    remarks: tagValue(block, 'COMMENTS1'),
    aliases,
  };
}

export async function refreshUnSanctions(env: Env): Promise<RefreshResult> {
  const res = await fetch(SOURCE_PAGE, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`UN consolidated sanctions list fetch failed: HTTP ${res.status}`);
  const xml = await res.text();
  const gate = await changeGate(env, 'un_sanctions', xml);
  if (gate.unchanged) return { source: 'un_sanctions', rows: 0, unchanged: true };
  if (!xml.includes('<CONSOLIDATED_LIST')) throw new Error('UN consolidated sanctions list response did not look like the expected XML -- feed may have changed');

  const individualBlocks = tagBlocks(xml, 'INDIVIDUAL').map(parseIndividual);
  const entityBlocks = tagBlocks(xml, 'ENTITY').map(parseEntity);
  const records = [...individualBlocks, ...entityBlocks].filter((r) => r.name.length > 0 && r.dataId);

  if (records.length === 0) {
    throw new Error('UN sanctions refresh produced zero entries -- aborting without touching un_sanctions_entries/aliases');
  }

  const today = new Date().toISOString().slice(0, 10);
  let entryId = 1;
  let aliasId = 1;
  const entryRows: string[] = [];
  const aliasRows: string[] = [];

  for (const r of records) {
    const id = entryId++;
    entryRows.push(
      `(${id}, ${sqlString(r.dataId)}, ${sqlString(r.entityType)}, ${sqlString(r.name)}, ${sqlString(normalizeNameString(r.name))}, ` +
        `${sqlString(r.listType)}, ${sqlString(r.referenceNumber)}, ${sqlString(r.listedOn)}, ${sqlString(r.nationality)}, ` +
        `${sqlString(r.addresses)}, ${sqlString(r.remarks)}, ${sqlString(CITATION_URL)}, 1, ${sqlString(today)})`
    );
    for (const a of r.aliases) {
      aliasRows.push(`(${aliasId++}, ${id}, ${sqlString(a.alias)}, ${sqlString(normalizeNameString(a.alias))}, ${sqlString(a.aliasType)})`);
    }
  }

  const entryStatements = buildInsertStatements(
    `INSERT INTO un_sanctions_entries (id, uid, entity_type, primary_name, name_normalized, un_list_type, reference_number, listed_on, nationality, addresses, remarks, source_url, source_tier, last_updated) VALUES`,
    entryRows,
    150
  );
  const aliasStatements = buildInsertStatements(`INSERT INTO un_sanctions_aliases (id, un_id, alias, alias_normalized, alias_type) VALUES`, aliasRows, 300);

  await env.DB.batch([
    env.DB.prepare('DELETE FROM un_sanctions_aliases'),
    env.DB.prepare('DELETE FROM un_sanctions_entries'),
    ...entryStatements.map((s) => env.DB.prepare(s)),
    ...aliasStatements.map((s) => env.DB.prepare(s)),
  ]);

  await gate.commit();
  return { source: 'un_sanctions', rows: entryRows.length + aliasRows.length };
}
