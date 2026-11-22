// Parsers for the everyday data (src/lib/pulse/everyday.ts): Treasury customs receipts and State Department travel advisories.
// No network. Run: npm run test:unit
import assert from 'node:assert/strict';
import { parseAdvisories, parseCustomsRows } from '../src/lib/pulse/everyday.js';

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

test('customs receipts become monthly gross and net points; other lines are ignored', () => {
  const rows = parseCustomsRows([
    { record_date: '2026-10-31', classification_desc: 'Customs Duties', current_month_gross_rcpt_amt: '25951273084.45', current_month_net_rcpt_amt: '19217228460.18' },
    { record_date: '2026-10-31', classification_desc: 'Excise Taxes', current_month_gross_rcpt_amt: '1', current_month_net_rcpt_amt: '1' },
    { record_date: 'bad', classification_desc: 'Customs Duties', current_month_gross_rcpt_amt: '1', current_month_net_rcpt_amt: '1' },
  ]);
  assert.deepEqual(rows, [
    { id: 'TREAS:CUSTOMS_GROSS', date: '2026-10-01', value: 25951273084.45 },
    { id: 'TREAS:CUSTOMS_NET', date: '2026-10-01', value: 19217228460.18 },
  ]);
});

test('advisories are matched by country name, not the feed\'s FIPS codes', () => {
  const items = parseAdvisories([
    { Title: 'Philippines - Level 2: Exercise Increased Caution', Link: 'https://travel.state.gov/ph', Updated: '2026-08-31T20:00:00-04:00' },
    { Title: 'Mexico Travel Advisory - Level 2: Exercise Increased Caution', Link: 'x' },
    { Title: 'Russia - Level 4: Do Not Travel', Link: 'y' },
    { Title: 'Worldwide Caution', Link: 'z' },
  ]);
  assert.deepEqual(
    items.map((i) => [i.country, i.level]),
    [
      ['PH', 2],
      ['MX', 2],
      ['RU', 4],
    ]
  );
  assert.equal(items[0].updated, '2026-08-31');
});

if (failures) {
  console.error(`\n${failures} FAIL`);
  process.exit(1);
}
