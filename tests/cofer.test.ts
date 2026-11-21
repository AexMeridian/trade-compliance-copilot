// Deterministic test for the IMF COFER CSV parsing (no network, no database). Run: npm run test:unit

import assert from 'node:assert/strict';
import { parseCoferCsv } from '../src/lib/pulse/cofer.js';

const csv = [
  'STRUCTURE,STRUCTURE_ID,ACTION,COUNTRY,INDICATOR,CURRENCY,TYPE_OF_TRANSFORMATION,FREQUENCY,TIME_PERIOD,OBS_VALUE',
  'dataflow,IMF.STA:COFER(7.0.1),R,G001,AFXRA,CI_CNY,SHRO_PT,Q,2026-Q1,1.98',
  'dataflow,IMF.STA:COFER(7.0.1),R,G001,AFXRA,CI_CNY,SHRO_PT,Q,2026-Q2,2.11',
  'dataflow,IMF.STA:COFER(7.0.1),R,G001,AFXRA,CI_CNY,SHRO_PT,Q,bad,2.5',
  'dataflow,IMF.STA:COFER(7.0.1),R,G001,AFXRA,CI_CNY,SHRO_PT,Q,2026-Q3,',
].join('\n');

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

test('quarters are stored as their first day, and unparseable rows are skipped rather than guessed', () => {
  assert.deepEqual(parseCoferCsv(csv, 'COFER:CNY_SHARE'), [
    { id: 'COFER:CNY_SHARE', date: '2026-01-01', value: 1.98 },
    { id: 'COFER:CNY_SHARE', date: '2026-04-01', value: 2.11 },
  ]);
});

test('a changed CSV shape throws instead of storing nothing quietly', () => {
  assert.throws(() => parseCoferCsv('a,b\n1,2', 'X'));
});

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
