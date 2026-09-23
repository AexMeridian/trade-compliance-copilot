// Derives hts_schedule_b_xref by joining on HS-6 (the first 6 digits, which are
// harmonized internationally and identical between HTS and Schedule B -- only
// the last 4 digits, the US-specific statistical suffix, differ between the two
// schedules). Reads the already-generated hts/*.sql and schedule_b/*.sql batch
// files' htsno/code values back out rather than querying a live D1 connection,
// so this can run entirely offline as part of the same seed-sql generation
// pass, before anything is loaded into D1.

import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { sqlString, buildBatchedInserts } from './lib/sql.js';

const HTS_DIR = 'scripts/seed-sql/hts';
const SB_DIR = 'scripts/seed-sql/schedule_b';
const OUT_DIR = 'scripts/seed-sql/xref';

// Pulls the (htsno-or-code, hs6) pairs back out of generated INSERT SQL by
// re-parsing the value tuples -- simpler and less error-prone than threading
// the in-memory row data between three separate script invocations.
// Extracts top-level "(...)" value tuples from generated INSERT SQL, tracking
// quote state so that literal parentheses inside a quoted description (e.g.
// "Instruments (musical)") never get mistaken for tuple boundaries.
function extractTuples(text: string): string[] {
  const tuples: string[] = [];
  let depth = 0;
  let inQuotes = false;
  let cur = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      cur += c;
      if (c === "'" && text[i + 1] === "'") {
        cur += text[++i];
      } else if (c === "'") {
        inQuotes = false;
      }
      continue;
    }
    if (c === "'") {
      inQuotes = true;
      if (depth > 0) cur += c;
      continue;
    }
    if (c === '(') {
      depth++;
      if (depth === 1) {
        cur = '';
        continue;
      }
    }
    if (c === ')') {
      depth--;
      if (depth === 0) {
        tuples.push(cur);
        continue;
      }
    }
    if (depth >= 1) cur += c;
  }
  return tuples;
}

function extractCodes(dir: string, codeFieldIndex: number): { code: string; digits: string; hs6: string }[] {
  const out: { code: string; digits: string; hs6: string }[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.sql')) continue;
    const text = readFileSync(`${dir}/${file}`, 'utf-8');
    for (const tuple of extractTuples(text)) {
      const fields = splitTopLevel(tuple);
      const code = unquote(fields[codeFieldIndex]);
      const digits = code.replace(/\./g, '');
      if (digits.length >= 6 && /^\d+$/.test(digits)) {
        out.push({ code, digits, hs6: digits.slice(0, 6) });
      }
    }
  }
  return out;
}

// Splits a SQL value-tuple's inner text on top-level commas (i.e. not commas
// inside a quoted string), good enough for the simple literal shapes this
// project's own generator scripts produce.
function splitTopLevel(s: string): string[] {
  const parts: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      cur += c;
      if (c === "'" && s[i + 1] === "'") {
        cur += s[++i];
      } else if (c === "'") {
        inQuotes = false;
      }
    } else if (c === "'") {
      inQuotes = true;
      cur += c;
    } else if (c === ',') {
      parts.push(cur.trim());
      cur = '';
    } else {
      cur += c;
    }
  }
  parts.push(cur.trim());
  return parts;
}

function unquote(v: string | undefined): string {
  if (!v) return '';
  const t = v.trim();
  if (t.startsWith("'") && t.endsWith("'")) return t.slice(1, -1).replace(/''/g, "'");
  return t;
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  // hts_lines tuple shape: (id, htsno[1], indent, description, superior_id, units, general_rate, special_rate, other_rate, footnotes, chapter, revision, source_url, source_tier, last_updated)
  const htsCodes = extractCodes(HTS_DIR, 1).filter((c) => c.digits.length === 10); // only fully-specified 10-digit statistical lines
  // schedule_b_lines tuple shape: (id, code[1], indent, description, superior_id, units, hs6, chapter, edition, source_url, source_tier, last_updated)
  const sbCodes = extractCodes(SB_DIR, 1);

  const sbByHs6 = new Map<string, string[]>();
  for (const { code, hs6 } of sbCodes) {
    if (!sbByHs6.has(hs6)) sbByHs6.set(hs6, []);
    sbByHs6.get(hs6)!.push(code);
  }

  const rows: string[] = [];
  for (const { code: htsno, hs6 } of htsCodes) {
    const sbMatches = sbByHs6.get(hs6);
    if (!sbMatches) continue;
    for (const sbCode of sbMatches) {
      rows.push(`(${sqlString(htsno)}, ${sqlString(sbCode)}, ${sqlString(hs6)})`);
    }
  }

  const sql = buildBatchedInserts(
    `INSERT INTO hts_schedule_b_xref (hts_htsno, schedule_b_code, hs6) VALUES`,
    rows,
    300
  );
  writeFileSync(`${OUT_DIR}/xref.sql`, sql + '\n');
  console.log(`Done. ${rows.length} HTS<->Schedule B cross-reference rows -> ${OUT_DIR}/xref.sql`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
