// Loads the full Schedule B schedule from the Census Bureau's AES Filer
// concordance CSV (census.gov/foreign-trade/aes/documentlibrary/concordance/
// expaescsv.txt). This IS a genuine primary-source, full-breadth Schedule B
// data file (10-digit codes, descriptions, units) -- despite Census not
// exposing a REST API for Schedule B, this AES-filer reference file turned out
// to cover the complete current schedule, so this loader is NOT a thinned-down
// manual curation; it is a full bulk load, matching HTS chapter coverage.
//
// The file is flat (no indent/hierarchy info the way the HTS exportList API
// provides it) -- every row is loaded at indent 0 with no superior_id.

import { mkdirSync, writeFileSync } from 'node:fs';
import { parseCsvLine } from './lib/csv.js';
import { sqlString, buildBatchedInserts } from './lib/sql.js';

const OUT_DIR = 'scripts/seed-sql/schedule_b';
const SOURCE_URL = 'https://www.census.gov/foreign-trade/aes/documentlibrary/concordance/expaescsv.txt';
const TODAY = new Date().toISOString().slice(0, 10);
const UA = 'trade-compliance-copilot-research/1.0 (portfolio project data loader)';

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const res = await fetch(SOURCE_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Schedule B fetch failed: HTTP ${res.status}`);
  const lastModified = res.headers.get('last-modified');
  const edition = lastModified
    ? `Census Schedule B (AES Filer CSV), file dated ${lastModified}`
    : `Census Schedule B (AES Filer CSV), as retrieved ${TODAY}`;

  const text = await res.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  if (header[0] !== 'hs') {
    throw new Error(`Unexpected Schedule B CSV header: ${lines[0]}`);
  }

  let id = 1;
  const byChapter = new Map<string, string[]>();

  for (const line of lines.slice(1)) {
    const [code, description, auq1, auq2] = parseCsvLine(line);
    if (!code || code.length !== 10) continue; // skip malformed/summary rows
    const hs6 = code.slice(0, 6);
    const chapter = code.slice(0, 2);
    const units = [auq1, auq2].filter((u) => u && u.trim().length > 0);

    const row =
      `(${id}, ${sqlString(code)}, 0, ${sqlString(description ?? '')}, NULL, ${sqlString(JSON.stringify(units))}, ` +
      `${sqlString(hs6)}, ${sqlString(chapter)}, ${sqlString(edition)}, ${sqlString(SOURCE_URL)}, 1, ${sqlString(TODAY)})`;
    id++;

    if (!byChapter.has(chapter)) byChapter.set(chapter, []);
    byChapter.get(chapter)!.push(row);
  }

  let total = 0;
  for (const [chapter, rows] of [...byChapter.entries()].sort()) {
    const sql = buildBatchedInserts(
      `INSERT INTO schedule_b_lines (id, code, indent, description, superior_id, units, hs6, chapter, edition, source_url, source_tier, last_updated) VALUES`,
      rows,
      200
    );
    writeFileSync(`${OUT_DIR}/${chapter}.sql`, sql + '\n');
    total += rows.length;
  }

  console.log(`Done. ${total} Schedule B rows across ${byChapter.size} chapters -> ${OUT_DIR}/`);
  console.log(`Edition: ${edition}`);
  console.log(`Next: npm run seed:xref, then npm run seed:load-local`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
