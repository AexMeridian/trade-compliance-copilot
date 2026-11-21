// Deterministic tests for the sanctioned-parties-by-country tally. No network, no database.
// Run: npm run test:unit

import assert from 'node:assert/strict';
import { tallyBySource, tallyCountries } from '../src/lib/pulse/sanctionCounts.js';

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

test('New Mexico is not counted as Mexico', () => {
  const out = tallyCountries(['Albuquerque, New Mexico, United States', 'Mexico City, Mexico']);
  assert.deepEqual(out.map((r) => [r.country, r.count]), [['MX', 1]]);
});

test('"Hong Kong, China" counts for Hong Kong only, not also China', () => {
  const out = tallyCountries(['Central, Hong Kong, China', 'Kowloon, Hong Kong', 'Beijing, China']);
  assert.deepEqual(out.map((r) => [r.country, r.count]), [['HK', 2], ['CN', 1]]);
});

test('per-list tally keeps OFAC and Commerce/State apart and adds up to the total', () => {
  const out = tallyBySource({ sdn: ['Tehran, Iran', 'Moscow, Russia'], csl: ['Tehran, Iran'], un: [], uk: ['Moscow, Russia'] });
  const ir = out.find((r) => r.country === 'IR')!;
  const ru = out.find((r) => r.country === 'RU')!;
  assert.deepEqual(ir.bySource, { sdn: 1, csl: 1, un: 0, uk: 0 });
  assert.equal(ir.count, 2);
  assert.deepEqual(ru.bySource, { sdn: 1, csl: 0, un: 0, uk: 1 });
});

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll sanction-count tests passed');
