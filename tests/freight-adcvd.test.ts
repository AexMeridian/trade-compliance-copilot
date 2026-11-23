// Freight indicators (NY Fed GSCPI spreadsheet reader, IMF PortWatch weekly averages) and AD/CVD order parsing and matching, against small saved
// fixtures. No network, no database. Run: npm run test:unit
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGscpi, weeklyTransits } from '../src/lib/pulse/freight.js';
import { adcvdMigrationSql, matchAdcvdOrders, parseAdcvdCsv } from '../src/lib/adcvd.js';

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

test('GSCPI spreadsheet: reads month-end dates and values, skips the blank rows above the data', () => {
  const rows = parseGscpi(new Uint8Array(readFileSync('tests/fixtures/gscpi-sample.xls')));
  assert.equal(rows.length, 5);
  assert.deepEqual(rows[0], { id: 'NYFED:GSCPI', date: '1998-01-01', value: -1.179 });
  assert.deepEqual(rows.at(-1), { id: 'NYFED:GSCPI', date: '2026-10-01', value: 1.262 });
});

test('GSCPI: a file that is not a spreadsheet is rejected, not misread', () => {
  assert.throws(() => parseGscpi(new TextEncoder().encode('<html>Access Denied</html>'.repeat(40))), /not a spreadsheet/);
});

test('PortWatch: complete Monday-to-Sunday weeks become one mean per week; a short week is dropped', () => {
  const sample = JSON.parse(readFileSync('tests/fixtures/portwatch-daily-sample.json', 'utf8')) as { features: { attributes: { date: string; portid: string; n_total: number } }[] };
  const weekly = weeklyTransits(sample.features);
  const suez = weekly.filter((w) => w.id === 'PW:chokepoint1');
  assert.deepEqual(suez.map((w) => w.date), ['2026-11-02', '2026-11-09']);
  const days = sample.features.filter((f) => f.attributes.portid === 'chokepoint1' && f.attributes.date >= '2026-11-02' && f.attributes.date <= '2026-11-08');
  assert.equal(days.length, 7);
  const mean = days.reduce((s, f) => s + f.attributes.n_total, 0) / 7;
  assert.equal(suez[0].value, Math.round(mean * 10) / 10);
  // Drop one day from the second week: that week disappears.
  const short = sample.features.filter((f) => !(f.attributes.portid === 'chokepoint1' && f.attributes.date === '2026-11-12'));
  assert.deepEqual(weeklyTransits(short).filter((w) => w.id === 'PW:chokepoint1').map((w) => w.date), ['2026-11-02']);
});

test('PortWatch: chokepoints outside the list are ignored', () => {
  assert.deepEqual(weeklyTransits([{ attributes: { date: '2026-11-02', portid: 'chokepoint99', n_total: 5 } }]), []);
});

const CSV = [
  'case_number,country_code,country,product,order_date,rate_min,rate_max,hts_prefixes,chapters,source_url',
  'A-570-001,CN,China,Steel nails,2008-08-01,0,118.04,7317,,https://example.test/a',
  'C-570-002,CN,China,Aluminum extrusions,2011-05-26,5.5,374.15,,76,',
  'A-533-003,IN,India,Steel nails,2015-01-01,1,2,7317,,',
  'X-000-000,CN,China,Not a case number,,,,,,',
  'A-570-001,CN,China,Duplicate,,,,,,',
].join('\n');
const meta = { source: 'fixture export', asOf: '2026-11-22', defaultUrl: 'https://access.trade.gov/adcvd' };

test('AD/CVD CSV: case-number letter sets the type; bad and duplicate rows are skipped', () => {
  const orders = parseAdcvdCsv(CSV, meta);
  assert.deepEqual(orders.map((o) => [o.case_number, o.order_type]), [['A-570-001', 'AD'], ['C-570-002', 'CVD'], ['A-533-003', 'AD']]);
  assert.equal(orders[0].rate_max, 118.04);
  assert.equal(orders[1].source_url, 'https://access.trade.gov/adcvd');
});

test('AD/CVD match: HTS prefix, country must agree, chapter+words fallback is labeled keyword', () => {
  const orders = parseAdcvdCsv(CSV, meta);
  const nails = matchAdcvdOrders(orders, '7317.00.55', 'CN', 'Nails, tacks, staples of iron or steel');
  assert.deepEqual(nails.map((m) => [m.case_number, m.basis]), [['A-570-001', 'hts']]);
  assert.equal(matchAdcvdOrders(orders, '7317.00.55', 'VN', 'Nails').length, 0);
  const alu = matchAdcvdOrders(orders, '7604.29.10', 'CN', 'Bars, rods and profiles of aluminum alloy: extruded aluminum');
  assert.deepEqual(alu.map((m) => [m.case_number, m.basis]), [['C-570-002', 'keyword']]);
  // Same words in the wrong chapter, or no shared words, never match.
  assert.equal(matchAdcvdOrders(orders, '3926.90.99', 'CN', 'Articles of aluminum extrusions').length, 0);
  assert.equal(matchAdcvdOrders(orders, '7604.29.10', 'CN', 'Bars of copper').length, 0);
});

test('AD/CVD migration SQL: replaces the table and quotes text', () => {
  const sql = adcvdMigrationSql(parseAdcvdCsv(CSV.replace('Steel nails,2008', "Steel nail's,2008"), meta));
  assert.match(sql, /^DELETE FROM adcvd_orders;/);
  assert.match(sql, /'Steel nail''s'/);
  assert.equal(adcvdMigrationSql([]).trim(), 'DELETE FROM adcvd_orders;');
});

if (failures) {
  console.error(`${failures} test(s) failed`);
  process.exit(1);
}
