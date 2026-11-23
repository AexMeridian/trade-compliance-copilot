// Remittance cost parser (World Bank Indicators API shape) and the sentence shown on country pages. No network. Run: npm run test:unit
import assert from 'node:assert/strict';
import { parseWbIndicator, remittanceSentence } from '../src/lib/pulse/remittance.js';

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

const row = (id: string, iso3: string, date: string, value: number | null) => ({ country: { id, value: id }, countryiso3code: iso3, date, value });
// Shape of https://api.worldbank.org/v2/country/all/indicator/SI.RMT.COST.IB.ZS?format=json&mrv=1 (saved values, 2026-11-22).
const sample = [
  { page: 1, pages: 1, per_page: 400, total: 5, sourceid: '2', lastupdated: '2026-11-11' },
  [row('PH', 'PHL', '2023', 1.67202385714286), row('MX', 'MXN'.slice(0, 2) + 'X', '2023', 4.5), row('1A', '', '2023', 6.1), row('AF', 'AFG', '2023', null), row('IN', 'IND', '2022', 150)],
];

test('keeps country rows with a value, drops aggregates, empty values and impossible percentages', () => {
  const m = parseWbIndicator(sample);
  assert.deepEqual([...m.keys()].sort(), ['MX', 'PH']);
  assert.deepEqual(m.get('PH'), { pct: 1.67, year: 2023 });
});

test('a malformed response gives an empty map, not an error', () => {
  assert.equal(parseWbIndicator(null).size, 0);
  assert.equal(parseWbIndicator([{ message: [{ id: '120' }] }]).size, 0);
});

test('the newest year wins when a country appears twice', () => {
  const m = parseWbIndicator([{}, [row('PH', 'PHL', '2021', 5), row('PH', 'PHL', '2023', 3)]]);
  assert.deepEqual(m.get('PH'), { pct: 3, year: 2023 });
});

test('the sentence states the percent, the year and the dollars on $200', () => {
  assert.equal(remittanceSentence('the Philippines', { pct: 1.67, year: 2023 }), 'Sending $200 to the Philippines costs about 1.7% on average (2023), roughly $3.34.');
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
