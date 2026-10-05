// Deterministic regression tests for the duty-stack arithmetic -- no network,
// no LLM, no database. These pin the behaviors found wrong in the calculator
// trial runs (special-rate parsing, FTA preference lines, China Section 301
// gap) so they can't silently regress. Run: npm run test:unit

import assert from 'node:assert/strict';
import { buildDutyStack, parseAdValoremRate, specialRateForSymbol } from '../src/lib/dutyStack.js';
import type { HtsCandidateRow } from '../src/lib/db.js';

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${name}\n      ${(e as Error).message}`);
  }
}

function hts(general: string, special: string): HtsCandidateRow {
  return {
    id: 1, htsno: '0000.00.00', description: 'test line', indent: 1, superior_id: null, units: '[]',
    general_rate: general, special_rate: special, other_rate: '', footnotes: '[]', chapter: '00',
    revision: 'test-rev', source_url: 'https://example.test', source_tier: 1, last_updated: '2026-01-01', score: 0,
  };
}

// --- special-rate parsing ---------------------------------------------------
test('"Free (...S...)" resolves to 0% for S (was null before the fix)', () => {
  assert.equal(specialRateForSymbol('Free (A,AU,BH,CL,CO,D,E,IL,JO,KR,MA,OM,P,PA,PE,S,SG)', 'S')?.pct, 0);
});
test('multi-group special rate picks the group containing the symbol', () => {
  const s = '3.4% (S) Free (AU,CO)';
  assert.equal(specialRateForSymbol(s, 'S')?.pct, 3.4);
  assert.equal(specialRateForSymbol(s, 'CO')?.pct, 0);
});
test('symbol not listed -> null, never a guessed rate', () => {
  assert.equal(specialRateForSymbol('Free (A,AU)', 'CO'), null);
  assert.equal(specialRateForSymbol('', 'S'), null);
});
test('"S" does not false-match inside "S+" or other symbols', () => {
  assert.equal(specialRateForSymbol('Free (S+)', 'S'), null);
  assert.equal(specialRateForSymbol('Free (SG)', 'S'), null);
});
test('general-rate parsing unchanged', () => {
  assert.equal(parseAdValoremRate('6.8%').pct, 6.8);
  assert.equal(parseAdValoremRate('Free').pct, 0);
  assert.equal(parseAdValoremRate('9.1cents/kg').pct, null);
});

// --- USMCA path -------------------------------------------------------------
test('USMCA-qualifying Mexican good with "Free (...S...)" totals 0, not null', () => {
  const r = buildDutyStack(hts('6.8%', 'Free (A,AU,S,SG)'), 'MX', true, []);
  assert.equal(r.totalPct, 0);
});
test('non-qualifying Mexican good pays the general rate', () => {
  const r = buildDutyStack(hts('6.8%', 'Free (A,AU,S,SG)'), 'MX', false, []);
  assert.equal(r.totalPct, 6.8);
});

// --- other FTAs: shown, never applied ---------------------------------------
test('Colombia: preferential line shown but NOT in total (origin not verified)', () => {
  const r = buildDutyStack(hts('6.8%', 'Free (A,AU,BH,CL,CO,D,E,IL,JO,KR,MA,OM,P,PA,PE,S,SG)'), 'CO', null, []);
  assert.equal(r.totalPct, 6.8);
  const fta = r.lines.find((l) => l.layer.includes('CO free trade agreement'));
  assert.ok(fta, 'expected an FTA line');
  assert.equal(fta.rate_pct, 0);
  assert.equal(fta.applies, false);
});
test('country with no FTA symbol gets no FTA line', () => {
  const r = buildDutyStack(hts('6.8%', 'Free (A,AU,CO)'), 'VN', null, []);
  assert.equal(r.lines.some((l) => l.layer.includes('free trade agreement')), false);
});
test('FTA country but line does not list its symbol -> no FTA line', () => {
  const r = buildDutyStack(hts('6.8%', 'Free (A,AU)'), 'CO', null, []);
  assert.equal(r.lines.some((l) => l.layer.includes('free trade agreement')), false);
});

// --- China Section 301 gap is disclosed, not silent --------------------------
test('China origin with no sec301_china data emits an explicit NOT EVALUATED line', () => {
  const r = buildDutyStack(hts('16.5%', ''), 'CN', null, []);
  const line = r.lines.find((l) => l.layer.includes('Section 301 (China'));
  assert.ok(line, 'expected the disclosure line');
  assert.equal(line.applies, false);
  assert.equal(line.rate_pct, null);
  assert.equal(r.totalPct, 16.5, 'a null-rate non-applied line must not poison the total');
});
test('non-China origin has no China 301 line', () => {
  const r = buildDutyStack(hts('16.5%', ''), 'VN', null, []);
  assert.equal(r.lines.some((l) => l.layer.includes('Section 301 (China')), false);
});

// --- EU-scoped overlays reach member states ---------------------------------
// Overlays are matched on the origin country code; a row scoped to 'EU' must
// still apply to Germany ('DE'), or no member state could ever get the EU's
// Section 232 cap / Section 301 row.
async function overlaysFor(country: string) {
  const { getApplicableOverlays } = await import('../src/lib/db.js');
  const row = (program: string, scope: string | null) => ({ id: 1, program, hts_pattern: '%', country_scope: scope, rate_pct: 15 });
  const rows = [row('sec232_metals_country_cap', 'EU'), row('sec301_forced_labor', 'EU'), row('sec232_metals_country_cap', 'JP')];
  const env = { DB: { prepare: () => ({ all: async () => ({ results: rows }) }) } };
  return getApplicableOverlays(env as never, '7208.10.30.00', country);
}
const asyncTests: [string, () => Promise<void>][] = [
  ['EU-scoped overlays apply to Germany', async () => assert.equal((await overlaysFor('DE')).filter((o) => o.country_scope === 'EU').length, 2)],
  ['EU-scoped overlays apply to a smaller member (Malta)', async () => assert.equal((await overlaysFor('MT')).filter((o) => o.country_scope === 'EU').length, 2)],
  ['EU-scoped overlays do NOT apply to non-members (Norway, UK)', async () => {
    assert.equal((await overlaysFor('NO')).length, 0);
    assert.equal((await overlaysFor('GB')).length, 0);
  }],
  ['an exact-code row (JP) still matches only JP', async () => assert.deepEqual((await overlaysFor('JP')).map((o) => o.country_scope), ['JP'])],
];
for (const [name, fn] of asyncTests) {
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
console.log('\nAll duty-stack tests passed');
