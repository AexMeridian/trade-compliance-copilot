// China Section 301 (Lists 1, 2, 3, 4A and the note 31 increases): the loaded migration data and the duty-stack arithmetic, by hand. The rows are read
// from migrations 0080 to 0085 applied to a real in-memory SQLite database; every expected total is worked out by hand from the rate each line's list
// carries (HTSUS 2026 Revision 23, U.S. notes 20 and 31 of chapter 99). No network, no model. Run: npm run test:unit
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { buildDutyStack, china301Assessment } from '../src/lib/dutyStack.js';
import { getApplicableOverlays, type HtsCandidateRow, type TariffOverlayRow } from '../src/lib/db.js';

let failures = 0;
const tests: [string, () => void | Promise<void>][] = [];
const test = (name: string, fn: () => void | Promise<void>) => tests.push([name, fn]);

const db = new DatabaseSync(':memory:');
db.exec(readFileSync('migrations/0003_schema_usmca_eccn_chart.sql', 'utf8'));
for (const f of [
  '0080_sec301_china_list1_list2.sql', '0081_sec301_china_list3_part1.sql', '0082_sec301_china_list3_part2.sql',
  '0083_sec301_china_list4a.sql', '0084_sec301_china_partial_lines_and_note31.sql', '0085_sec301_china_coverage_marker.sql',
]) db.exec(readFileSync(`migrations/${f}`, 'utf8'));

function overlaysFor(code8: string): TariffOverlayRow[] {
  return db.prepare(`SELECT * FROM tariff_overlays WHERE program = 'sec301_china_coverage' OR (program = 'sec301_china' AND hts_pattern = ?)`).all(code8.replace(/\./g, '')) as unknown as TariffOverlayRow[];
}
function line(htsno: string, general: string): HtsCandidateRow {
  return {
    id: 1, htsno, description: 'test line', indent: 1, superior_id: null, units: '[]', general_rate: general, special_rate: '', other_rate: '', footnotes: '[]', chapter: htsno.slice(0, 2),
    revision: 'test-rev', source_url: 'https://example.test', source_tier: 1, last_updated: '2026-01-01', score: 0,
  };
}
const NOW = '2026-11-22';
const stack = (code: string, general: string, onDate = NOW) => buildDutyStack(line(code, general), 'CN', null, overlaysFor(code), onDate);
const china = (r: ReturnType<typeof stack>) => r.lines.filter((l) => l.layer.startsWith('Section 301 (China'));

// --- the loaded data ----------------------------------------------------------------------------------------------------------------------------
const count = (where: string) => (db.prepare(`SELECT COUNT(*) AS n FROM tariff_overlays WHERE program = 'sec301_china' AND (${where})`).get() as { n: number }).n;
test('list sizes read from U.S. notes 20(b), 20(d), 20(f), 20(s)(i) (856, 283, 5906, 2958 lines)', () => {
  assert.equal(count(`legal_basis LIKE 'Section 301, China, List 1:%'`), 856);
  assert.equal(count(`legal_basis LIKE 'Section 301, China, List 2:%'`), 283);
  assert.equal(count(`legal_basis LIKE 'Section 301, China, List 3:%'`), 5906);
  assert.equal(count(`legal_basis LIKE 'Section 301, China, List 4A:%'`), 2958);
});
test('note 31 increases: 348 + 2 + 10 + 18 + 5 + 3 lines plus 4015.12.10', () => {
  assert.equal(count(`legal_basis LIKE '%heading 9903.91.01,%'`), 348);
  assert.equal(count(`legal_basis LIKE '%heading 9903.91.02,%'`), 2);
  assert.equal(count(`legal_basis LIKE '%heading 9903.91.03,%'`), 10);
  assert.equal(count(`legal_basis LIKE '%heading 9903.91.05,%'`), 18);
  assert.equal(count(`legal_basis LIKE '%heading 9903.91.06,%'`), 5);
  assert.equal(count(`legal_basis LIKE '%heading 9903.91.11,%'`), 3);
  assert.equal(count(`legal_basis LIKE '%heading 9903.91.08,%'`), 1);
});
test('every row has an 8-digit pattern, the China scope, the pinned USITC source and a data-as-of date', () => {
  assert.equal(count(`length(hts_pattern) <> 8 OR hts_pattern GLOB '*[^0-9]*'`), 0);
  assert.equal(count(`country_scope <> 'CN' OR source_url NOT LIKE 'https://hts.usitc.gov/reststop/file?release=2026HTSRev23%' OR data_as_of <> '2026-11-22' OR source_tier <> 1`), 0);
});
test('no 8-digit line sits in two of Lists 1, 2, 3 and 4A', () => {
  const dup = db.prepare(`SELECT hts_pattern FROM tariff_overlays WHERE program = 'sec301_china' AND (legal_basis LIKE 'Section 301, China, List 1:%' OR legal_basis LIKE 'Section 301, China, List 2:%' OR legal_basis LIKE 'Section 301, China, List 3:%' OR legal_basis LIKE 'Section 301, China, List 4A:%') GROUP BY hts_pattern HAVING COUNT(DISTINCT legal_basis) > 1`).all();
  assert.deepEqual(dup, []);
});
test('rates are 25 for Lists 1 to 3 and 7.5 for List 4A', () => {
  assert.equal(count(`legal_basis LIKE 'Section 301, China, List 1:%' AND rate_pct <> 25`), 0);
  assert.equal(count(`legal_basis LIKE 'Section 301, China, List 2:%' AND rate_pct <> 25`), 0);
  assert.equal(count(`legal_basis LIKE 'Section 301, China, List 3:%' AND rate_pct <> 25`), 0);
  assert.equal(count(`legal_basis LIKE 'Section 301, China, List 4A:%' AND rate_pct <> 7.5`), 0);
});

// --- per-line totals, by hand -----------------------------------------------------------------------------------------------------------------------------
test('List 1 line 2845.20.00 (not excluded): Column 1 3% + 25% = 28%', () => {
  const r = stack('2845.20.00', '3%');
  assert.equal(r.totalPct, 28);
  assert.equal(china(r)[0].applies, true);
  assert.match(china(r)[0].layer, /List 1, heading 9903\.88\.01/);
});
test('List 2 line 2710.19.30: Column 1 2% + 25% = 27%', () => assert.equal(stack('2710.19.30', '2%').totalPct, 27));
test('List 3 line 0203.29.20: Column 1 4% + 25% = 29%', () => assert.equal(stack('0203.29.20', '4%').totalPct, 29));
test('List 3 furniture line 9403.60.80: Free + 25% = 25%', () => assert.equal(stack('9403.60.80', 'Free').totalPct, 25));
test('List 4A line 0101.21.00: Column 1 10% + 7.5% = 17.5%', () => assert.equal(stack('0101.21.00', '10%').totalPct, 17.5));
test('List 4A footwear line 6401.10.00: Column 1 37.5% + 7.5% = 45%', () => assert.equal(stack('6401.10.00', '37.5%').totalPct, 45));
test('List 4A knit apparel 6110.20.20 has exclusions listed by statistical number: review, total is the Column 1 rate (16.5%)', () => {
  const r = stack('6110.20.20', '16.5%');
  assert.equal(r.totalPct, 16.5);
  assert.match(china(r)[0].layer, /NOT EVALUATED/);
});
test('a smartphone line 8517.13.00 is in no list (4B is suspended): total is the Column 1 rate only, line says "not covered"', () => {
  const r = stack('8517.13.00', 'Free');
  assert.equal(r.totalPct, 0);
  assert.equal(china(r).length, 1);
  assert.match(china(r)[0].layer, /not covered/);
  assert.equal(china(r)[0].applies, false);
});
test('a List 4B-only line 7323.93.00 (suspended heading 9903.88.16) is not covered', () => assert.equal(china(stack('7323.93.00', '2%'))[0].layer.endsWith('not covered'), true));
test('note 31(d) electric vehicles 8703.80.00: Column 1 2.5% + 100% = 102.5%', () => assert.equal(stack('8703.80.00', '2.5%').totalPct, 102.5));
test('note 31(c) solar cells 8541.42.00: Free + 50% = 50%', () => assert.equal(stack('8541.42.00', 'Free').totalPct, 50));
test('note 31(b) steel mill product 7208.10.15: Free + 25% = 25%', () => assert.equal(stack('7208.10.15', 'Free').totalPct, 25));
test('note 31(f) semiconductor 8542.31.00: Free + 50% = 50%', () => assert.equal(stack('8542.31.00', 'Free').totalPct, 50));
test('note 31(g) 8507.60.00 (lithium-ion batteries): in force 2026-01-01, so 25% on 2026-11-22 and nothing on 2025-12-31', () => {
  assert.equal(stack('8507.60.00', 'Free').totalPct, 25);
  const before = stack('8507.60.00', 'Free', '2025-12-31');
  assert.equal(before.totalPct, 0);
  assert.match(china(before)[0].layer, /not covered/);
});
test('note 31(i) 4015.12.10 (medical gloves): 100% from 2026-01-01', () => assert.equal(stack('4015.12.10', '3%').totalPct, 103));

// --- conservative cases: never a guessed rate -------------------------------------------------------------------------------------------------------------
test('List 1 line 8413.91.90 has USTR exclusions by statistical number in U.S. note 20(vvv): review, total excludes the 301 duty', () => {
  const r = stack('8413.91.90', '5%');
  assert.equal(r.totalPct, 5);
  assert.match(china(r)[0].layer, /NOT EVALUATED/);
  assert.match(china(r)[0].reason_if_not_applied ?? '', /exclusion/i);
  assert.equal(china301Assessment(overlaysFor('8413.91.90'), '84139190', NOW).state, 'review');
});
test('8517.62.00 is covered by 9903.88.04 and 9903.88.15 only in part (depends on the statistical suffix): review', () => {
  const a = china301Assessment(overlaysFor('8517.62.00'), '85176200', NOW);
  assert.equal(a.state, 'review');
  assert.equal(a.rows.length, 2);
  assert.equal(stack('8517.62.00', '2%').totalPct, 2);
});
test('9401.71.00 and 6307.90.98 are partial lines: review', () => {
  assert.equal(china301Assessment(overlaysFor('9401.71.00'), '94017100', NOW).state, 'review');
  assert.equal(china301Assessment(overlaysFor('6307.90.98'), '63079098', NOW).state, 'review');
});
test('cranes 8426.19.00 are covered only if ship-to-shore gantry cranes: review', () => assert.equal(china301Assessment(overlaysFor('8426.19.00'), '84261900', NOW).state, 'review'));
test('chassis 8716.90.30 (List 3 today) gains a 2027-01-10 chassis heading: firm List 3 rate before, review after', () => {
  assert.equal(china301Assessment(overlaysFor('8716.90.30'), '87169030', NOW).state, 'covered');
  assert.equal(china301Assessment(overlaysFor('8716.90.30'), '87169030', '2027-02-01').state, 'review');
});
test('a heading-level code with covered lines under it is review; one with none under it is not covered', async () => {
  const rows = db.prepare(`SELECT * FROM tariff_overlays WHERE program = 'sec301_china_coverage' OR (program = 'sec301_china' AND hts_pattern LIKE '9403%')`).all() as unknown as TariffOverlayRow[];
  assert.equal(china301Assessment(rows, '9403', NOW).state, 'review');
  const none = db.prepare(`SELECT * FROM tariff_overlays WHERE program = 'sec301_china_coverage'`).all() as unknown as TariffOverlayRow[];
  assert.equal(china301Assessment(none, '8517', NOW).state, 'not_covered');
});
test('without the coverage record and without rows, the line stays NOT EVALUATED and the total excludes it', () => {
  const r = buildDutyStack(line('2845.20.00', '3%'), 'CN', null, [], NOW);
  assert.match(china(r)[0].layer, /NOT EVALUATED/);
  assert.equal(r.totalPct, 3);
});
test('a non-China origin gets no China line', () => {
  const r = buildDutyStack(line('2845.20.00', '3%'), 'VN', null, overlaysFor('2845.20.00'), NOW);
  assert.equal(china(r).length, 0);
});

// --- lookup: the China rows are fetched for China only, by 8-digit code, once the coverage record is loaded ---------------------------------------------
function mockEnv() {
  const calls: string[] = [];
  const env = {
    DB: {
      prepare: (sql: string) => {
        calls.push(sql);
        const stmt = db.prepare(sql);
        return {
          all: async () => ({ results: stmt.all() }),
          bind: (...args: unknown[]) => ({ all: async () => ({ results: stmt.all(...(args as never[])) }) }),
        };
      },
    },
  };
  return { env: env as never, calls };
}
test('getApplicableOverlays: China, 10-digit code reads the 8-digit line and the coverage record', async () => {
  const { env } = mockEnv();
  const rows = await getApplicableOverlays(env, '2845.20.00.00', 'CN');
  assert.equal(rows.filter((r) => r.program === 'sec301_china').length, 1);
  assert.equal(rows.filter((r) => r.program === 'sec301_china_coverage').length, 1);
});
test('getApplicableOverlays: another country never reads the China rows', async () => {
  const { env, calls } = mockEnv();
  const rows = await getApplicableOverlays(env, '2845.20.00', 'VN');
  assert.equal(rows.some((r) => r.program.startsWith('sec301_china')), false);
  assert.equal(calls.some((s) => s.includes('hts_pattern = ?1')), false);
});

for (const [name, fn] of tests) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${name}\n      ${(e as Error).message}`);
  }
}
if (failures > 0) {
  console.log(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll China Section 301 tests passed');
