// In-Worker port of scripts/build-schedule-b.ts -- see src/lib/refresh/hts.ts
// for the fetch-fully-before-writing safety rationale, which applies equally
// here.
import type { Env } from '../../types/env.js';
import { parseCsvLine } from './csv.js';
import { sqlString, buildInsertStatements } from './sql.js';
import type { RefreshResult } from './types.js';

const SOURCE_URL = 'https://www.census.gov/foreign-trade/aes/documentlibrary/concordance/expaescsv.txt';
const UA = 'trade-compliance-copilot-research/1.0 (portfolio project data loader)';

export async function refreshScheduleB(env: Env): Promise<RefreshResult> {
  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(SOURCE_URL, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Schedule B fetch failed: HTTP ${res.status}`);
  const lastModified = res.headers.get('last-modified');
  const edition = lastModified
    ? `Census Schedule B (AES Filer CSV), file dated ${lastModified}`
    : `Census Schedule B (AES Filer CSV), as retrieved ${today}`;

  const text = await res.text();
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  if (header[0] !== 'hs') {
    throw new Error(`Unexpected Schedule B CSV header: ${lines[0]}`);
  }

  let id = 1;
  const rows: string[] = [];
  for (const line of lines.slice(1)) {
    const [code, description, auq1, auq2] = parseCsvLine(line);
    if (!code || code.length !== 10) continue; // skip malformed/summary rows
    const hs6 = code.slice(0, 6);
    const chapter = code.slice(0, 2);
    const units = [auq1, auq2].filter((u) => u && u.trim().length > 0);

    rows.push(
      `(${id}, ${sqlString(code)}, 0, ${sqlString(description ?? '')}, NULL, ${sqlString(JSON.stringify(units))}, ` +
        `${sqlString(hs6)}, ${sqlString(chapter)}, ${sqlString(edition)}, ${sqlString(SOURCE_URL)}, 1, ${sqlString(today)})`
    );
    id++;
  }

  if (rows.length === 0) {
    throw new Error('Schedule B refresh produced zero rows -- aborting without touching schedule_b_lines');
  }

  const insertStatements = buildInsertStatements(
    `INSERT INTO schedule_b_lines (id, code, indent, description, superior_id, units, hs6, chapter, edition, source_url, source_tier, last_updated) VALUES`,
    rows,
    200
  );

  await env.DB.batch([
    env.DB.prepare('DELETE FROM schedule_b_lines'),
    ...insertStatements.map((s) => env.DB.prepare(s)),
  ]);

  return { source: 'schedule_b', rows: rows.length };
}
