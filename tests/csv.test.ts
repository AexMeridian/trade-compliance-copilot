// Deterministic tests for the CSV export helper: quoting and spreadsheet-formula protection.
// Run: npm run test:unit

import assert from 'node:assert/strict';
import { toCsv } from '../frontend/src/lib/csv.js';

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

test('quotes commas, quotes and newlines', () => {
  assert.equal(toCsv(['a', 'b'], [['x,y', 'say "hi"'], ['line\nbreak', 'plain']]), 'a,b\r\n"x,y","say ""hi"""\r\n"line\nbreak",plain');
});

test('neutralises spreadsheet formulas', () => {
  const out = toCsv(['name'], [['=HYPERLINK("http://evil")'], ['+1'], ['-2'], ['@SUM(A1)'], ['safe']]);
  assert.ok(out.includes(`"'=HYPERLINK(""http://evil"")"`));
  assert.ok(out.includes("'+1") && out.includes("'-2") && out.includes("'@SUM(A1)"));
  assert.ok(out.endsWith('safe'));
});

test('empty and null values become empty cells', () => {
  assert.equal(toCsv(['a', 'b', 'c'], [[null, undefined, '']]), 'a,b,c\r\n,,');
});

if (failures) {
  console.error(`\n${failures} csv test(s) failed`);
  process.exit(1);
}
console.log('\nAll csv tests passed');
