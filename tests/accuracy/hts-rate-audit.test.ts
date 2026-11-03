// Accuracy audit of rate parsing over the whole loaded HTS (about 32,000 lines). Every Column 1 General rate and every rate group in the Special
// column is run through the calculator's parsers and compared with a separate, deliberately plain reading of the same string. A string the
// calculator cannot read as one ad valorem percentage must come back null (flagged for manual review), never a number.
// Reads the local D1 file that `wrangler dev` creates and skips when it is not there (CI has no seeded database). No network, no model.
// Run: npx tsx tests/accuracy/hts-rate-audit.test.ts

import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { parseAdValoremRate, specialRateForSymbol } from '../../src/lib/dutyStack.js';

const dir = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';
const file = existsSync(dir)
  ? readdirSync(dir)
      .filter((f) => f.endsWith('.sqlite'))
      .map((f) => join(dir, f))
      .sort((a, b) => statSync(b).size - statSync(a).size)[0]
  : undefined;
if (!file) {
  console.log('skip  no local database found (run wrangler dev once and load the reference data)');
  process.exit(0);
}
const db = new DatabaseSync(file as string, { readOnly: true });
const rows = db.prepare('SELECT htsno, general_rate, special_rate FROM hts_lines').all() as { htsno: string; general_rate: string | null; special_rate: string | null }[];
if (rows.length < 1000) {
  console.log(`skip  only ${rows.length} HTS lines loaded`);
  process.exit(0);
}

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL ${name}\n  ${(err as Error).message}`);
  }
}

// The plain reading: a rate is "Free", or exactly one percentage (an empty markup tag after it is ignored). Anything else is not a plain
// ad valorem rate.
function plain(raw: string): number | null | 'empty' {
  const s = raw.replace(/<[^>]*>/g, '').trim();
  if (s === '') return 'empty';
  if (/^free$/i.test(s)) return 0;
  const m = s.match(/^(\d+(?:\.\d+)?)\s*%$/);
  return m ? Number(m[1]) : null;
}

test(`General rate: the parser agrees with the plain reading on all ${rows.length} lines`, () => {
  const wrong: string[] = [];
  for (const r of rows) {
    const g = r.general_rate ?? '';
    const expected = plain(g);
    const got = parseAdValoremRate(g).pct;
    if (expected === 'empty' ? got !== null : got !== expected) wrong.push(`${r.htsno} ${JSON.stringify(g)} -> ${got}`);
  }
  assert.deepEqual(wrong.slice(0, 20), [], `${wrong.length} lines disagree`);
});

test('General rate: no compound or part-specific rate is read as a single percentage', () => {
  const leaked = rows.filter((r) => /^\s*\d+(\.\d+)?\s*%.*[A-Za-z+]/.test((r.general_rate ?? '').replace(/<[^>]*>/g, '')) && parseAdValoremRate(r.general_rate ?? '').pct !== null);
  assert.deepEqual(leaked.map((r) => `${r.htsno} ${r.general_rate}`).slice(0, 20), []);
});

test('Special column: every program group is read exactly as the plain reading says', () => {
  let groups = 0;
  const wrong: string[] = [];
  for (const r of rows) {
    const s = r.special_rate ?? '';
    for (const m of s.matchAll(/([^()]*?)\s*\(([^)]*)\)/g)) {
      const symbols = m[2].split(',').map((x) => x.trim()).filter(Boolean);
      const expected = plain(m[1]);
      for (const sym of symbols) {
        groups++;
        const got = specialRateForSymbol(s, sym);
        if (!got) {
          wrong.push(`${r.htsno} ${sym} not found in ${JSON.stringify(s)}`);
          continue;
        }
        // The first group that lists the symbol wins, as in the calculator.
        const firstOwn = [...s.matchAll(/([^()]*?)\s*\(([^)]*)\)/g)].find((x) => x[2].split(',').map((y) => y.trim()).includes(sym));
        const exp = plain(firstOwn![1]);
        if ((exp === 'empty' ? null : exp) !== got.pct) wrong.push(`${r.htsno} ${sym} ${JSON.stringify(s)} -> ${got.pct}`);
        void expected;
      }
    }
  }
  console.log(`      checked ${groups} program entries`);
  assert.deepEqual(wrong.slice(0, 20), [], `${wrong.length} disagreements`);
});

// The audit's report: how much of the schedule the calculator can total, and how much it must send to manual review.
test('Report: share of rate-bearing lines the calculator can total', () => {
  const withRate = rows.filter((r) => (r.general_rate ?? '').trim() !== '');
  const total = withRate.filter((r) => parseAdValoremRate(r.general_rate ?? '').pct !== null).length;
  const manual = withRate.length - total;
  console.log(`      ${withRate.length} lines carry their own General rate: ${total} are ad valorem or Free (${((100 * total) / withRate.length).toFixed(1)}%), ${manual} go to manual review (specific or compound rates)`);
  assert.ok(total / withRate.length > 0.85);
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
