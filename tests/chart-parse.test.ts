// Country Chart import: the parser on a small fixture, and the stored snapshot (data/country-chart.json) against facts that are easy to check
// by eye on the official chart. No network, no model. Run: npm run test:unit

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { parseCountryChart, CHART_COLUMNS } from '../src/lib/chartParse.js';
import { CHART_NAME_TO_ISO } from '../src/lib/chartNames.js';

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

const cell = (v: string) => `<TD class="center">${v}</TD>`;
const head = `<TR>${CHART_COLUMNS.map((c) => `<TH>${c.slice(0, 2)} ${c.slice(2)}</TH>`).join('')}</TR>`;
const country = (name: string, marked: string[]) => `<TR><TD class="left">${name} <sup>3</sup></TD>${CHART_COLUMNS.map((c) => cell(marked.includes(c) ? 'X' : '')).join('')}</TR>`;
const fixture = (n: number) =>
  `<TABLE><THEAD><TR><TH rowspan="2">Countries</TH><TH colspan="3">Chemical and<br></br>biological weapons</TH></TR>${head}</THEAD><TBODY>` +
  Array.from({ length: n }, (_, i) => country(i === 0 ? 'Germany' : `Place ${i}`, i === 0 ? ['CB1', 'NS1', 'MT1', 'RS1'] : ['NS1'])).join('') +
  `<TR><TD>See § 746.1(b) for United Nations Security Council Sanctions under the EAR.</TD></TR></TBODY></TABLE>`;

test('a country row becomes its marked columns; footnote rows and superscripts are ignored', () => {
  const rows = parseCountryChart(fixture(160));
  assert.equal(rows.length, 160);
  assert.deepEqual(rows[0], { name: 'Germany', marked: ['CB1', 'NS1', 'MT1', 'RS1'] });
});
test('a changed column layout stops the import', () => {
  const broken = fixture(160).replace('<TH>CB 1</TH>', '<TH>CB 9</TH>');
  assert.throws(() => parseCountryChart(broken), /header row not found|columns changed/);
});
test('a table with too few countries stops the import', () => {
  assert.throws(() => parseCountryChart(fixture(20)), /Only 20 countries/);
});
test('XML with no table stops the import', () => {
  assert.throws(() => parseCountryChart('<DIV>nothing</DIV>'), /No table found/);
});

if (!existsSync('data/country-chart.json')) {
  console.log('skip snapshot checks: data/country-chart.json not generated yet');
} else {
  const snap = JSON.parse(readFileSync('data/country-chart.json', 'utf8')) as { countries: Record<string, { name: string; marked: string[] }> };
  const marks = (iso: string) => snap.countries[iso]?.marked.join(' ');
  test('the snapshot covers every destination except the four embargoed ones, whose chart rows only point to Part 746', () => {
    const missing = [...new Set(Object.values(CHART_NAME_TO_ISO))].filter((iso) => !snap.countries[iso]).sort();
    assert.deepEqual(missing, ['CU', 'IR', 'KP', 'SY']);
    assert.ok(Object.keys(snap.countries).length >= 190);
  });
  test('Germany is marked for CB1, NS1, MT1 and RS1 only', () => assert.equal(marks('DE'), 'CB1 NS1 MT1 RS1'));
  test('Canada has no national-security mark', () => {
    assert.ok(!snap.countries.CA.marked.some((m) => m.startsWith('NS')), marks('CA'));
  });
  test('China is marked for NS2 and the Russia-style embargo list is dense', () => {
    assert.ok(snap.countries.CN.marked.includes('NS2'));
    assert.ok(snap.countries.RU.marked.length >= 10);
  });
  test('Liechtenstein follows Switzerland', () => assert.equal(marks('LI'), marks('CH')));
  test('every mark is a known column', () => {
    for (const [iso, c] of Object.entries(snap.countries)) for (const m of c.marked) assert.ok((CHART_COLUMNS as readonly string[]).includes(m), `${iso} ${m}`);
  });
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
