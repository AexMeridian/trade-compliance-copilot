// Deterministic tests for the sanctioned-parties-by-country tally. No network, no database.
// Run: npm run test:unit

import assert from 'node:assert/strict';
import { tallyCountries } from '../src/lib/pulse/sanctionCounts.js';

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

test('counts one party per country named in its text', () => {
  const out = tallyCountries(['Tehran, Iran', 'Isfahan, Iran', 'Moscow, Russia']);
  assert.deepEqual(out.map((r) => [r.country, r.count]), [['IR', 2], ['RU', 1]]);
});

test('ranks by count, then country code', () => {
  const out = tallyCountries(['Moscow, Russia', 'Tehran, Iran']);
  assert.deepEqual(out.map((r) => r.country), ['IR', 'RU']);
});

test('skips parties with no recognisable country and U.S. addresses', () => {
  const out = tallyCountries(['', 'nowhere in particular', 'New York, United States', 'Beijing, China']);
  assert.deepEqual(out.map((r) => r.country), ['CN']);
});

test('ignores roundups that name many countries', () => {
  const roundup = 'Branches in Iran; Russia; China; North Korea; Syria; Cuba';
  assert.deepEqual(tallyCountries([roundup, 'Beijing, China']).map((r) => [r.country, r.count]), [['CN', 1]]);
});

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll sanction-count tests passed');
