// In-Worker port of scripts/fetch-hts.ts for the scheduled auto-refresh (see
// src/scheduled.ts). Same source, same chapter range, same indent-stack
// superior_id resolution, same escaping -- the only real difference is where
// the output goes: instead of writing batched INSERT SQL to disk for a later
// `wrangler d1 execute --file=`, every statement is collected in memory and
// applied in ONE atomic env.DB.batch() call at the end. This is deliberate:
// if the fetch fails partway through (chapter 40 of 97, say), nothing has
// touched hts_lines yet, so a failed refresh leaves the last-known-good data
// in place rather than a half-deleted table -- the failure mode of deleting
// first and reloading second is exactly what this ordering avoids.
import type { Env } from '../../types/env.js';
import { sqlString, sqlJson, buildInsertStatements } from './sql.js';
import type { RefreshResult } from './types.js';

const UA = 'trade-compliance-copilot-research/1.0 (portfolio project data loader)';
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
  if (!res.ok) throw new Error(`HTS chapter ${chapter}: HTTP ${res.status} from ${url}`);
  const text = await res.text();
  if (!text.trim().startsWith('[')) {
    throw new Error(`HTS chapter ${chapter}: unexpected non-JSON-array response: ${text.slice(0, 200)}`);
  }
  return JSON.parse(text) as HtsApiRow[];
}

export async function refreshHts(env: Env): Promise<RefreshResult> {
  const today = new Date().toISOString().slice(0, 10);
  const revision = `USITC HTS, as retrieved ${today}`;
  let globalId = 1;
  let totalRows = 0;
  const insertStatements: string[] = [];

  for (const chapter of CHAPTERS) {
    const chStr = String(chapter).padStart(2, '0');
    const apiRows = await fetchChapter(chapter); // throws -> aborts before any DB write, see header comment
    if (apiRows.length === 0) continue;

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
          `${sqlString(chStr)}, ${sqlString(revision)}, ${sqlString(url)}, 1, ${sqlString(today)})`
      );
    }

    insertStatements.push(
      ...buildInsertStatements(
        `INSERT INTO hts_lines (id, htsno, indent, description, superior_id, units, general_rate, special_rate, other_rate, footnotes, chapter, revision, source_url, source_tier, last_updated) VALUES`,
        rowsSql,
        200
      )
    );
    totalRows += rowsSql.length;

    // Same politeness delay as the Node script -- doesn't count against CPU
    // time, only wall-clock (well within the 15-minute Cron Trigger budget).
    await new Promise((r) => setTimeout(r, 300));
  }

  if (totalRows === 0) {
    throw new Error('HTS refresh produced zero rows across all chapters -- aborting without touching hts_lines');
  }

  await env.DB.batch([env.DB.prepare('DELETE FROM hts_lines'), ...insertStatements.map((s) => env.DB.prepare(s))]);

  return { source: 'hts', rows: totalRows };
}
