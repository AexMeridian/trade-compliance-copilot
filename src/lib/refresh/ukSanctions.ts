// UK Sanctions List, published by OFSI (HM Treasury) -- see
// migrations/0020_schema_uk_sanctions.sql's header for why this is a
// separate table from SDN/CSL/UN rather than tagged into any of them.
//
// SOURCE_URL is a stable, non-expiring Azure blob URL (unlike the UN feed's
// SAS-signed redirect) -- verified live, no auth/token needed.
//
// The feed is a flat list of name *variants*: each <FinancialSanctionsTarget>
// is one row, and rows that belong to the same real-world designation share
// a UKSanctionsListRef, with exactly one row (usually) marked
// AliasType="Primary name" and the rest AliasType in {AKA, FKA, "Primary
// name variation"}. This groups by that ref and collapses each group into
// one uk_sanctions_entries row + N aliases -- verified against the live file
// that a small number of groups (2 of 5135 at verification time) have no
// "Primary name" row, handled by falling back to the group's first row.
import type { Env } from '../../types/env.js';
import { normalizeNameString } from '../normalize.js';
import { sqlString, buildInsertStatements } from './sql.js';
import type { RefreshResult } from './types.js';

const SOURCE_URL = 'https://ofsistorage.blob.core.windows.net/publishlive/2022format/ConList.xml';
const CITATION_URL = 'https://sanctionslist.fcdo.gov.uk';
const UA = 'aex-terminal-research/1.0 (portfolio project data loader)';

function tagValue(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
  if (!m) return null;
  const v = m[1].replace(/\s+/g, ' ').trim();
  return v.length > 0 ? v : null;
}

interface TargetRow {
  ref: string;
  groupId: string | null;
  groupType: string;
  aliasType: string | null;
  regimeName: string | null;
  listingType: string | null;
  dateListed: string | null;
  statementOfReasons: string | null;
  name: string;
  address: string | null;
}

function buildName(block: string): string {
  const parts = ['Title', 'name1', 'name2', 'name3', 'name4', 'name5', 'Name6'].map((t) => tagValue(block, t));
  return parts.filter(Boolean).join(' ');
}

function buildAddress(block: string): string | null {
  const lines = ['Address1', 'Address2', 'Address3', 'Address4', 'Address5', 'Address6'].map((t) => tagValue(block, t));
  const country = tagValue(block, 'Country');
  return [...lines, country].filter(Boolean).join(', ') || null;
}

function parseTarget(block: string): TargetRow | null {
  const ref = tagValue(block, 'UKSanctionsListRef');
  if (!ref) return null;
  const name = buildName(block);
  if (!name) return null;
  return {
    ref,
    groupId: tagValue(block, 'GroupID'),
    groupType: tagValue(block, 'GroupTypeDescription') ?? 'Entity',
    aliasType: tagValue(block, 'AliasType'),
    regimeName: tagValue(block, 'RegimeName'),
    listingType: tagValue(block, 'ListingType'),
    dateListed: tagValue(block, 'DateListed'),
    statementOfReasons: tagValue(block, 'UKStatementOfReasons'),
    name,
    address: buildAddress(block),
  };
}

export async function refreshUkSanctions(env: Env): Promise<RefreshResult> {
  const res = await fetch(SOURCE_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`UK sanctions list fetch failed: HTTP ${res.status}`);
  const xml = await res.text();
  if (!xml.includes('<ArrayOfFinancialSanctionsTarget') && !xml.includes('<FinancialSanctionsTarget>')) {
    throw new Error('UK sanctions list response did not look like the expected XML -- feed may have changed');
  }

  const blocks = xml.match(/<FinancialSanctionsTarget>[\s\S]*?<\/FinancialSanctionsTarget>/g) ?? [];
  const targets = blocks.map(parseTarget).filter((t): t is TargetRow => t !== null);

  const groups = new Map<string, TargetRow[]>();
  for (const t of targets) {
    if (!groups.has(t.ref)) groups.set(t.ref, []);
    groups.get(t.ref)!.push(t);
  }

  if (groups.size === 0) {
    throw new Error('UK sanctions refresh produced zero entries -- aborting without touching uk_sanctions_entries/aliases');
  }

  const today = new Date().toISOString().slice(0, 10);
  let entryId = 1;
  let aliasId = 1;
  const entryRows: string[] = [];
  const aliasRows: string[] = [];

  for (const [ref, rows] of groups) {
    const primary = rows.find((r) => r.aliasType === 'Primary name') ?? rows[0];
    const id = entryId++;
    entryRows.push(
      `(${id}, ${sqlString(ref)}, ${sqlString(primary.groupId)}, ${sqlString(primary.groupType)}, ${sqlString(primary.name)}, ` +
        `${sqlString(normalizeNameString(primary.name))}, ${sqlString(primary.regimeName)}, ${sqlString(primary.listingType)}, ` +
        `${sqlString(primary.dateListed)}, ${sqlString(primary.address)}, ${sqlString(primary.statementOfReasons)}, ` +
        `${sqlString(CITATION_URL)}, 1, ${sqlString(today)})`
    );
    for (const r of rows) {
      if (r === primary || !r.name || r.name === primary.name) continue;
      aliasRows.push(`(${aliasId++}, ${id}, ${sqlString(r.name)}, ${sqlString(normalizeNameString(r.name))}, ${sqlString(r.aliasType)})`);
    }
  }

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

  return { source: 'uk_sanctions', rows: entryRows.length + aliasRows.length };
}
