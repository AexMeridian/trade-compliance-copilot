// CBP Withhold Release Orders & Findings (Section 307, 19 U.S.C. 1307) --
// see migrations/0017_schema_wro_findings.sql's header comment for why this
// (not the newer DHS UFLPA Entity List, which has no bulk feed) is the real
// forced-labor dataset this app ingests.
//
// No stable, predictable CSV URL -- live-verified the file is republished
// under a date-stamped filename each time CBP updates it (e.g.
// ".../withhold-release-orders-findings-fy26-2026-09-29.csv"), so this does
// a small discovery step first: fetch CBP's own document page (a fixed,
// stable URL) and extract whatever CSV link it currently points to, rather
// than guessing a filename from today's date.
//
// The CSV itself has quoted fields that can contain embedded commas AND
// newlines (e.g. a multi-line Remarks citation) -- verified against the real
// file, which is why this uses its own whole-text parser below instead of
// src/lib/refresh/csv.ts's parseCsvLine (built for line-at-a-time sources
// that don't do this).
import type { Env } from '../../types/env.js';
import { sqlString, buildInsertStatements } from './sql.js';
import type { RefreshResult } from './types.js';

const DOCUMENT_PAGE = 'https://www.cbp.gov/document/stats/withhold-release-orders-findings';
const ORIGIN = 'https://www.cbp.gov';
const UA = 'aex-terminal-research/1.0 (portfolio project data loader)';

function parseCsvFull(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      // no-op -- \n (below) ends the row for both \r\n and bare \n sources
    } else if (c === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const COL = {
  effectiveDate: 0,
  countryCode: 2,
  country: 3,
  merchandise: 4,
  orderType: 5,
  industry: 6,
  status: 7,
  entity: 9,
  remarks: 10,
} as const;

export async function refreshWroFindings(env: Env): Promise<RefreshResult> {
  const pageRes = await fetch(DOCUMENT_PAGE, { headers: { 'User-Agent': UA } });
  if (!pageRes.ok) throw new Error(`CBP WRO/Findings document page fetch failed: HTTP ${pageRes.status}`);
  const pageHtml = await pageRes.text();
  const match = pageHtml.match(/href="(\/sites\/default\/files\/[^"]*withhold-release-orders-findings[^"]*\.csv)"/i);
  if (!match) throw new Error('Could not find a WRO/Findings CSV link on the CBP document page -- page layout may have changed');
  const csvUrl = `${ORIGIN}${match[1]}`;

  const csvRes = await fetch(csvUrl, { headers: { 'User-Agent': UA } });
  if (!csvRes.ok) throw new Error(`WRO/Findings CSV fetch failed: HTTP ${csvRes.status}`);
  // Not UTF-8 -- verified against the live file (a 0xA0 byte that's a plain
  // non-breaking space in Windows-1252 decodes as a Unicode replacement
  // character under .text()'s default UTF-8 assumption). No charset is
  // declared in the response headers, so this is read as raw bytes and
  // decoded explicitly rather than trusting fetch's default.
  const text = new TextDecoder('windows-1252').decode(await csvRes.arrayBuffer());
  const allRows = parseCsvFull(text).filter((r) => r.length > 1 || r[0] !== '');
  const dataRows = allRows.slice(1); // drop header

  const today = new Date().toISOString().slice(0, 10);
  let id = 1;
  const rows: string[] = [];
  for (const fields of dataRows) {
    const entity = fields[COL.entity]?.trim();
    const orderType = fields[COL.orderType]?.trim();
    const status = fields[COL.status]?.trim();
    if (!entity || !orderType || !status) continue; // a handful of rows in this feed are formatting artifacts, not real entries

    rows.push(
      `(${id++}, ${sqlString(fields[COL.effectiveDate]?.trim() || null)}, ${sqlString(fields[COL.countryCode]?.trim() || null)}, ` +
        `${sqlString(fields[COL.country]?.trim() || null)}, ${sqlString(fields[COL.merchandise]?.trim() || null)}, ${sqlString(orderType)}, ` +
        `${sqlString(fields[COL.industry]?.trim() || null)}, ${sqlString(status)}, ${sqlString(entity)}, ` +
        `${sqlString(fields[COL.remarks]?.trim() || null)}, ${sqlString(csvUrl)}, ${sqlString(today)})`
    );
  }

  if (rows.length === 0) {
    throw new Error('WRO/Findings refresh produced zero entries -- aborting without touching wro_findings');
  }

  const statements = buildInsertStatements(
    `INSERT INTO wro_findings (id, effective_date, country_code, country, merchandise, order_type, industry, status, entity, remarks, source_url, last_updated) VALUES`,
    rows,
    150
  );

  await env.DB.batch([env.DB.prepare('DELETE FROM wro_findings'), ...statements.map((s) => env.DB.prepare(s))]);

  return { source: 'wro_findings', rows: rows.length };
}
