// Bulk-loads the full USITC HTS schedule, chapter by chapter, from the primary
// official source (hts.usitc.gov). Writes batched INSERT SQL under
// scripts/seed-sql/hts/ -- run `npm run seed:load-local` (or :load-remote)
// afterwards to actually execute it against D1. See scripts/refresh_data.md.
//
// The API silently 400s without a browser-like User-Agent and needs 4-digit
// from/to HTS range bounds (verified empirically against the live endpoint
// during this build -- the official user guide's examples were not sufficient
// on their own).

import { mkdirSync, writeFileSync } from 'node:fs';
import { sqlString, sqlJson, buildBatchedInserts } from './lib/sql.js';

const OUT_DIR = 'scripts/seed-sql/hts';
const TODAY = new Date().toISOString().slice(0, 10);
const REVISION = `USITC HTS, as retrieved ${TODAY}`;
const UA = 'trade-compliance-copilot-research/1.0 (portfolio project data loader)';

// Chapters 1-97 are in active use; 77 is reserved for future use and returns
// nothing. 98/99 (special classification / temporary legislation chapters)
// are intentionally excluded from this general bulk load -- they cover
// program-specific provisions, not general commercial classification, and
// are out of scope for a GRI-based product classifier.
const CHAPTERS = Array.from({ length: 97 }, (_, i) => i + 1).filter((c) => c !== 77);

interface HtsApiRow {
  htsno: string;
  indent: string;
  description: string;
  superior: string | null;
  units: string[];
  general: string;
  special: string;
  other: string;
  footnotes: unknown[] | null;
}

async function fetchChapter(chapter: number): Promise<HtsApiRow[]> {
  const from = String(chapter).padStart(2, '0') + '00';
  const to = String(chapter + 1).padStart(2, '0') + '00';
  const url = `https://hts.usitc.gov/reststop/exportList?from=${from}&to=${to}&format=JSON&styles=true`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) {
    throw new Error(`HTS chapter ${chapter}: HTTP ${res.status} from ${url}`);
  }
  const text = await res.text();
  if (!text.trim().startsWith('[')) {
    throw new Error(`HTS chapter ${chapter}: unexpected non-JSON-array response: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as HtsApiRow[];
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });
  let globalId = 1;
  let totalRows = 0;
  const chapterSummary: { chapter: number; rows: number }[] = [];

  for (const chapter of CHAPTERS) {
    const chStr = String(chapter).padStart(2, '0');
    let apiRows: HtsApiRow[];
    try {
      apiRows = await fetchChapter(chapter);
    } catch (err) {
      console.error(`SKIPPING chapter ${chStr}: ${(err as Error).message}`);
      continue;
    }
    if (apiRows.length === 0) {
      console.log(`Chapter ${chStr}: empty (likely reserved), skipping`);
      continue;
    }

    // Resolve superior_id via an indent-based stack: each row's parent is the
    // most recent prior row whose indent is exactly one less.
    const stack: { indent: number; id: number }[] = [];
    const rowsSql: string[] = [];
    const url = `https://hts.usitc.gov/reststop/exportList?from=${chStr}00&to=${String(chapter + 1).padStart(2, '0')}00&format=JSON&styles=true`;

    for (const row of apiRows) {
      const indent = Number(row.indent) || 0;
      while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop();
      const superiorId = stack.length ? stack[stack.length - 1].id : null;
      const id = globalId++;
      stack.push({ indent, id });

      rowsSql.push(
        `(${id}, ${sqlString(row.htsno ?? '')}, ${indent}, ${sqlString(row.description ?? '')}, ` +
          `${superiorId ?? 'NULL'}, ${sqlJson(row.units ?? [])}, ${sqlString(row.general ?? '')}, ` +
          `${sqlString(row.special ?? '')}, ${sqlString(row.other ?? '')}, ${sqlJson(row.footnotes ?? [])}, ` +
          `${sqlString(chStr)}, ${sqlString(REVISION)}, ${sqlString(url)}, 1, ${sqlString(TODAY)})`
      );
    }

    const sql = buildBatchedInserts(
      `INSERT INTO hts_lines (id, htsno, indent, description, superior_id, units, general_rate, special_rate, other_rate, footnotes, chapter, revision, source_url, source_tier, last_updated) VALUES`,
      rowsSql,
      200
    );
    writeFileSync(`${OUT_DIR}/${chStr}.sql`, sql + '\n');
    totalRows += rowsSql.length;
    chapterSummary.push({ chapter, rows: rowsSql.length });
    console.log(`Chapter ${chStr}: ${rowsSql.length} rows -> ${OUT_DIR}/${chStr}.sql`);

    // Be polite to a public government endpoint with no documented rate limit.
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nDone. ${totalRows} total HTS rows across ${chapterSummary.length} chapters.`);
  console.log(`Next: npm run seed:load-local  (or seed:load-remote)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
