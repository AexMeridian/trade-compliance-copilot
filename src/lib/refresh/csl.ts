// In-Worker port of scripts/fetch-csl.ts. Same EXCLUDED_SOURCES rationale as
// the original: the CSL re-publishes OFAC's SDN list under its own source
// tag, which this app already loads directly from OFAC with richer fields
// (see sdn.ts) -- those rows are skipped here to avoid duplicate, lower-
// fidelity entries.
import type { Env } from '../../types/env.js';
import { normalizeNameString } from '../normalize.js';
import { parseCsvLine } from './csv.js';
import { sqlString, buildInsertStatements } from './sql.js';
import type { RefreshResult } from './types.js';

const SOURCE_URL = 'https://www.trade.gov/consolidated-screening-list';
const CSV_URL = 'https://data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.csv';
const UA = 'trade-compliance-copilot-research/1.0 (portfolio project data loader)';

const EXCLUDED_SOURCES = new Set(['Specially Designated Nationals (SDN) - Treasury Department']);

const COL = {
  source: 1,
  name: 5,
  addresses: 7,
  federalRegisterNotice: 8,
  startDate: 9,
  licenseRequirement: 12,
  licensePolicy: 13,
  altNames: 22,
  sourceInformationUrl: 27,
} as const;

export async function refreshCsl(env: Env): Promise<RefreshResult> {
  const today = new Date().toISOString().slice(0, 10);

  const res = await fetch(CSV_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`CSL fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);

  let entryId = 1;
  let aliasId = 1;
  const entryRows: string[] = [];
  const aliasRows: string[] = [];

  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    const source = fields[COL.source]?.trim();
    const name = fields[COL.name]?.trim();
    if (!source || !name || EXCLUDED_SOURCES.has(source)) continue;

    const rowSourceUrl = fields[COL.sourceInformationUrl]?.trim() || SOURCE_URL;
    const id = entryId++;

    entryRows.push(
      `(${id}, ${sqlString(source)}, ${sqlString(name)}, ${sqlString(normalizeNameString(name))}, ` +
        `${sqlString(fields[COL.addresses] || null)}, ${sqlString(fields[COL.federalRegisterNotice] || null)}, ` +
        `${sqlString(fields[COL.licenseRequirement] || null)}, ${sqlString(fields[COL.licensePolicy] || null)}, ` +
        `${sqlString(fields[COL.startDate] || null)}, ${sqlString(rowSourceUrl)}, 1, ${sqlString(today)})`
    );

    const altNames = (fields[COL.altNames] || '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const alias of altNames) {
      aliasRows.push(`(${aliasId++}, ${id}, ${sqlString(alias)}, ${sqlString(normalizeNameString(alias))})`);
    }
  }

  if (entryRows.length === 0) {
    throw new Error('CSL refresh produced zero entries -- aborting without touching csl_entries/csl_aliases');
  }

  const entryStatements = buildInsertStatements(
    `INSERT INTO csl_entries (id, source_list, name, name_normalized, addresses, federal_register_notice, license_requirement, license_policy, start_date, source_url, source_tier, last_updated) VALUES`,
    entryRows,
    150
  );
  const aliasStatements = buildInsertStatements(
    `INSERT INTO csl_aliases (id, csl_id, alias, alias_normalized) VALUES`,
    aliasRows,
    300
  );

  await env.DB.batch([
    env.DB.prepare('DELETE FROM csl_aliases'),
    env.DB.prepare('DELETE FROM csl_entries'),
    ...entryStatements.map((s) => env.DB.prepare(s)),
    ...aliasStatements.map((s) => env.DB.prepare(s)),
  ]);

  return { source: 'csl', rows: entryRows.length + aliasRows.length };
}
