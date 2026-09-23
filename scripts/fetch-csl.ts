// Bulk-loads the BIS Entity List / Denied Persons List / and other non-SDN
// Consolidated Screening List sub-lists from trade.gov's official CSL download
// (primary source: data.trade.gov). The CSL also republishes OFAC's SDN list
// under its own "Specially Designated Nationals (SDN) - Treasury Department"
// source tag -- those rows are deliberately EXCLUDED here since this app
// already loads the SDN list directly from OFAC's own Sanctions List Service
// (scripts/fetch-ofac-sdn.ts) with richer structured fields (DOB, per-address
// detail, program tags) than the CSL's flattened CSV gives; loading both would
// just create duplicate, lower-fidelity SDN rows.

import { mkdirSync, writeFileSync } from 'node:fs';
import { parseCsvLine } from './lib/csv.js';
import { sqlString, buildBatchedInserts } from './lib/sql.js';
import { normalizeNameString } from '../src/lib/normalize.js';

const OUT_DIR = 'scripts/seed-sql/csl';
const SOURCE_URL = 'https://www.trade.gov/consolidated-screening-list';
const CSV_URL = 'https://data.trade.gov/downloadable_consolidated_screening_list/v1/consolidated.csv';
const TODAY = new Date().toISOString().slice(0, 10);
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
  remarks: 20,
  altNames: 22,
  sourceInformationUrl: 27,
} as const;

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Fetching ${CSV_URL} ...`);
  const res = await fetch(CSV_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`CSL fetch failed: HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  console.log(`Downloaded ${(text.length / 1_000_000).toFixed(1)} MB, ${lines.length - 1} data rows.`);

  let entryId = 1;
  let aliasId = 1;
  const entryRows: string[] = [];
  const aliasRows: string[] = [];
  const sourceCounts = new Map<string, number>();

  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    const source = fields[COL.source]?.trim();
    const name = fields[COL.name]?.trim();
    if (!source || !name || EXCLUDED_SOURCES.has(source)) continue;

    sourceCounts.set(source, (sourceCounts.get(source) ?? 0) + 1);
    const rowSourceUrl = fields[COL.sourceInformationUrl]?.trim() || SOURCE_URL;
    const id = entryId++;

    entryRows.push(
      `(${id}, ${sqlString(source)}, ${sqlString(name)}, ${sqlString(normalizeNameString(name))}, ` +
        `${sqlString(fields[COL.addresses] || null)}, ${sqlString(fields[COL.federalRegisterNotice] || null)}, ` +
        `${sqlString(fields[COL.licenseRequirement] || null)}, ${sqlString(fields[COL.licensePolicy] || null)}, ` +
        `${sqlString(fields[COL.startDate] || null)}, ${sqlString(rowSourceUrl)}, 1, ${sqlString(TODAY)})`
    );

    const altNames = (fields[COL.altNames] || '')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean);
    for (const alias of altNames) {
      aliasRows.push(`(${aliasId++}, ${id}, ${sqlString(alias)}, ${sqlString(normalizeNameString(alias))})`);
    }
  }

  const entrySql = buildBatchedInserts(
    `INSERT INTO csl_entries (id, source_list, name, name_normalized, addresses, federal_register_notice, license_requirement, license_policy, start_date, source_url, source_tier, last_updated) VALUES`,
    entryRows,
    150
  );
  writeFileSync(`${OUT_DIR}/01-entries.sql`, entrySql + '\n');

  const aliasSql = buildBatchedInserts(
    `INSERT INTO csl_aliases (id, csl_id, alias, alias_normalized) VALUES`,
    aliasRows,
    300
  );
  writeFileSync(`${OUT_DIR}/02-aliases.sql`, aliasSql + '\n');

  console.log(`Done. ${entryRows.length} CSL entries (SDN rows excluded), ${aliasRows.length} aliases -> ${OUT_DIR}/`);
  console.log('By source list:');
  for (const [src, n] of [...sourceCounts.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n}\t${src}`);
  console.log(`Next: npm run seed:load-local  (or seed:load-remote)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
