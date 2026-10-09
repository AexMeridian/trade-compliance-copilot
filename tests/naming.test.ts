// Deterministic checks on country naming: no abbreviated or outdated names reach the UI, and the
// extraction patterns handle the cases specialists check first. No network, no database.
// Run: npm run test:unit

import assert from 'node:assert/strict';
import { COUNTRY_LABELS } from '../frontend/src/lib/pulseCountries.js';
import { extractCountries, COUNTRY_LABELS as BACKEND_LABELS } from '../src/lib/pulse/country.js';
import { BLOC_MEMBERS, BRICS_PARTNERS } from '../frontend/src/lib/pulseBlocs.js';

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL  ${name}\n  ${(err as Error).message}`);
  }
}

test('no abbreviated place names in the display labels', () => {
  const abbreviated = Object.entries(COUNTRY_LABELS).filter(([, n]) => /\b(Rep\.|Is\.|Herz\.|Eq\.|Fr\.|S\.|W\.|N\.)/.test(n));
  assert.deepEqual(abbreviated, []);
});

test('current official names are used', () => {
  assert.equal(COUNTRY_LABELS.TR, 'Türkiye');
  assert.equal(COUNTRY_LABELS.MK, 'North Macedonia');
  assert.equal(COUNTRY_LABELS.SZ, 'Eswatini');
  assert.equal(COUNTRY_LABELS.CZ, 'Czechia');
  assert.equal(COUNTRY_LABELS.EH, 'Western Sahara');
  assert.equal(COUNTRY_LABELS.CD, 'Democratic Republic of the Congo');
  assert.equal(COUNTRY_LABELS.CG, 'Republic of the Congo');
});

test('the backend uses the same names as the display', () => {
  for (const code of ['TR', 'MK', 'SZ', 'CZ', 'CD', 'CG', 'PS']) assert.equal(BACKEND_LABELS[code], COUNTRY_LABELS[code], code);
});

test('extraction handles the usual traps', () => {
  assert.deepEqual(extractCountries('Republic of Türkiye'), ['TR']);
  assert.deepEqual(extractCountries('Democratic Republic of the Congo'), ['CD']);
  assert.deepEqual(extractCountries('Republic of the Congo'), ['CG']);
  assert.deepEqual(extractCountries('Democratic People\'s Republic of Korea'), ['KP']);
  assert.deepEqual(extractCountries('Republic of Korea'), ['KR']);
  assert.deepEqual(extractCountries('Atlanta, Georgia'), []); // the U.S. state is not the country
  assert.deepEqual(extractCountries('Swaziland'), ['SZ']);
});

test('bloc membership counts match the sources checked on 2026-10-09', () => {
  assert.equal(BLOC_MEMBERS.NATO.length, 31); // 32 members; the U.S. is implicit and left out of every list
  assert.equal(BLOC_MEMBERS.BRICS.length, 11);
  assert.equal(BLOC_MEMBERS.G20.length, 19); // 18 other countries + the EU; the U.S. is implicit; the African Union is non-country
  assert.equal(BRICS_PARTNERS.length, 10);
  for (const c of BRICS_PARTNERS) assert.ok(!BLOC_MEMBERS.BRICS.includes(c), `${c} is a partner, not a member`);
});

test('every bloc member and partner has a display name', () => {
  const codes = new Set([...Object.values(BLOC_MEMBERS).flat(), ...BRICS_PARTNERS]);
  for (const c of codes) assert.ok(COUNTRY_LABELS[c], `missing label for ${c}`);
});

if (failures) {
  console.error(`\n${failures} naming test(s) failed`);
  process.exit(1);
}
console.log('\nAll naming tests passed');
