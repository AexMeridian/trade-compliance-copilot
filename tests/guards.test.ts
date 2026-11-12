// The refresh shrink guard (src/lib/refresh/guards.ts): a load far smaller than the last one must be refused before it replaces a live table.
// No database, no network. Run: npm run test:unit

import assert from 'node:assert/strict';
import { shrinkError, MIN_SIZE_RATIO } from '../src/lib/refresh/guards.js';

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

test('the first load has nothing to compare with and is allowed', () => {
  assert.equal(shrinkError('sdn', null, 100), null);
  assert.equal(shrinkError('sdn', 0, 100), null);
});
test('a normal week-to-week change is allowed', () => {
  assert.equal(shrinkError('sdn', 18_000, 17_700), null);
  assert.equal(shrinkError('sdn', 18_000, 19_500), null);
});
test('exactly at the limit is allowed; just under is refused', () => {
  assert.equal(shrinkError('sdn', 1000, 1000 * MIN_SIZE_RATIO), null);
  assert.match(shrinkError('sdn', 1000, 1000 * MIN_SIZE_RATIO - 1) ?? '', /aborting without touching the live table/);
});
test('a half-size file names the source and both sizes', () => {
  const m = shrinkError('csl', 7000, 3500) ?? '';
  assert.match(m, /^csl refresh would load 3500 rows against 7000/);
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
