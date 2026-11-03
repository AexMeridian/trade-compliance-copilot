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

// --- compound rates are never read as one percentage ---------------------------
test('a compound or part-specific rate string is flagged, not read as its first percentage', () => {
  for (const raw of ['3.9% on the movement and case + 5.3% on the battery', '4.7% on the value of the rifle + 20% on the value of the telescopic sight, if any', '6.5% on the entire set', '4.3% + 1.7c/jewel + 0.2c for each other piece or part']) {
    assert.equal(parseAdValoremRate(raw).pct, null, raw);
  }
});

test('a plain percentage with an empty markup tag still parses', () => {
  assert.equal(parseAdValoremRate('2.5% <u></u>').pct, 2.5);
  assert.equal(parseAdValoremRate('10%<u></u>').pct, 10);
});

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

// --- additional duties (Section 232, 338, 301 forced labor): the arithmetic, by hand ------------------
// Totals below are worked out by hand from the rates the overlay rows carry (Federal Register 2026-11314 for the metals, 2026-14992 for
// Canada's dairy lines, 2026-15181 for the forced-labor action): general rate + each additional duty that applies.
function overlay(program: string, rate: number | null, extra: Partial<import('../src/lib/db.js').TariffOverlayRow> = {}) {
  return {
    id: 1, program, hts_pattern: '%', country_scope: null, rate_pct: rate, rate_type: 'ad_valorem', legal_basis: 'test basis', effective_date: '2026-01-01',
    expiration_date: null, exclusions: null, stacking_rule: null, source_url: 'https://example.test', source_tier: 1, last_updated: '2026-01-01', data_as_of: '2026-01-01',
    ...extra,
  } as import('../src/lib/db.js').TariffOverlayRow;
}

test('steel from a country with no cap: general rate + 50% (hand total 52.5)', () => {
  assert.equal(buildDutyStack(hts('2.5%', ''), 'VN', null, [overlay('sec232_steel', 50)]).totalPct, 52.5);
});
test('steel from a capped country: the Column 1 rate and the 232 duty add up to the 15% cap, not 15% on top (2.5 + 12.5 = 15)', () => {
  // Proclamation 11032 clause (2)(b): "the sum of the Column 1 Duty Rate and the additional section 232 ad valorem rate ... shall be 15 percent".
  const r = buildDutyStack(hts('2.5%', ''), 'JP', null, [overlay('sec232_steel', 50), overlay('sec232_metals_country_cap', 15)]);
  assert.equal(r.totalPct, 15);
  assert.equal(r.lines.find((l) => l.layer.startsWith('Section 232'))?.rate_pct, 12.5);
});
test('capped country, Column 1 rate already 15% or more: the 232 duty is zero (clause (2)(b))', () => {
  const r = buildDutyStack(hts('16%', ''), 'KR', null, [overlay('sec232_steel', 50), overlay('sec232_metals_country_cap', 15)]);
  assert.equal(r.totalPct, 16);
});
test('capped country with a specific-rate Column 1: the total is withheld, not guessed', () => {
  assert.equal(buildDutyStack(hts('9.1c/kg', ''), 'JP', null, [overlay('sec232_steel', 50), overlay('sec232_metals_country_cap', 15)]).totalPct, null);
});
test('a cap higher than the baseline never raises the duty (steel 50, cap 60: 52.5)', () => {
  assert.equal(buildDutyStack(hts('2.5%', ''), 'JP', null, [overlay('sec232_steel', 50), overlay('sec232_metals_country_cap', 60)]).totalPct, 52.5);
});
test('autos: general + 25% (hand total 27.5 for a 2.5% line)', () => {
  assert.equal(buildDutyStack(hts('2.5%', ''), 'JP', null, [overlay('sec232_autos', 25)]).totalPct, 27.5);
});
test('autos from Canada: Section 338 is excluded by anti-stacking, so 232 alone counts (2.5 + 25)', () => {
  const r = buildDutyStack(hts('2.5%', ''), 'CA', false, [overlay('sec232_autos', 25), overlay('sec338_canada', 50)]);
  assert.equal(r.totalPct, 27.5);
  assert.equal(r.lines.find((l) => l.layer === 'Section 338 (Canada)')?.applies, false);
});
test('Section 338 alone: the line is undetermined and the total is withheld, never a full 50% asserted', () => {
  const r = buildDutyStack(hts('10%', ''), 'CA', false, [overlay('sec338_canada', 50)]);
  assert.equal(r.totalPct, null);
  const line = r.lines.find((l) => l.layer === 'Section 338 (Canada)');
  assert.equal(line?.applies, false);
  assert.match(line?.reason_if_not_applied ?? '', /Undetermined/);
});
test('forced-labor Section 301 adds to the general rate (5 + 10 = 15)', () => {
  assert.equal(buildDutyStack(hts('5%', ''), 'VN', null, [overlay('sec301_forced_labor', 10)]).totalPct, 15);
});
test('a qualifying USMCA good keeps its additional duties (Free special + 25% autos = 25)', () => {
  assert.equal(buildDutyStack(hts('2.5%', 'Free (S)'), 'MX', true, [overlay('sec232_autos', 25)]).totalPct, 25);
});
test('a specific-rate line gives no total even with additional duties', () => {
  assert.equal(buildDutyStack(hts('9.1c/kg', ''), 'VN', null, [overlay('sec232_steel', 50)]).totalPct, null);
});

// --- Section 301 forced-labor action (USTR notice, 91 FR, July 28, 2026): exemptions and the combined-duty target ---
test('301 forced labor: goods already under Section 232 are exempt, so Vietnam steel is general + 50 only (52.5)', () => {
  const r = buildDutyStack(hts('2.5%', ''), 'VN', null, [overlay('sec232_steel', 50), overlay('sec301_forced_labor', 12.5)]);
  assert.equal(r.totalPct, 52.5);
  assert.equal(r.lines.find((l) => l.layer.includes('forced-labor'))?.applies, false);
});
test('301 forced labor, EU: the Column 1 rate plus this duty equals 10 (Column 1 2.5 gives 7.5, total 10)', () => {
  assert.equal(buildDutyStack(hts('2.5%', ''), 'DE', null, [overlay('sec301_forced_labor', 10)]).totalPct, 10);
});
test('301 forced labor, EU, Column 1 rate at or above 10: this duty is zero', () => {
  assert.equal(buildDutyStack(hts('12%', ''), 'FR', null, [overlay('sec301_forced_labor', 10)]).totalPct, 12);
});
test('301 forced labor, Japan: the combined target is 12.5 (Column 1 5 gives total 12.5)', () => {
  assert.equal(buildDutyStack(hts('5%', ''), 'JP', null, [overlay('sec301_forced_labor', 12.5)]).totalPct, 12.5);
});
test('301 forced labor, a specific-rate EU line: the total is withheld', () => {
  assert.equal(buildDutyStack(hts('9.1c/kg', ''), 'DE', null, [overlay('sec301_forced_labor', 10)]).totalPct, null);
});
test('301 forced labor, qualifying USMCA goods from Mexico are exempt (Free special, total 0)', () => {
  assert.equal(buildDutyStack(hts('2.5%', 'Free (S)'), 'MX', true, [overlay('sec301_forced_labor', 10)]).totalPct, 0);
});
test('301 forced labor, Mexico with USMCA not determined: the total is withheld', () => {
  assert.equal(buildDutyStack(hts('2.5%', 'Free (S)'), 'MX', null, [overlay('sec301_forced_labor', 10)]).totalPct, null);
});
test('301 forced labor, Mexican goods that do not qualify pay the added 10 (2.5 + 10 = 12.5)', () => {
  assert.equal(buildDutyStack(hts('2.5%', 'Free (S)'), 'MX', false, [overlay('sec301_forced_labor', 10)]).totalPct, 12.5);
});

if (failures > 0) {
  console.log(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll duty-stack tests passed');
