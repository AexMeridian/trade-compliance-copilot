// Parser tests for the Treasury (yield curve, TIC) and IMF commodity sources, using small excerpts of real
// responses so a changed upstream format fails here instead of silently emptying a panel.
// Run: npm run test:unit

import assert from 'node:assert/strict';
import { parseYieldXml, parseTicTable } from '../src/lib/pulse/treasury.js';
import { parsePcpsCsv } from '../src/lib/pulse/commodities.js';
import { isTradeRelevantPresidentialDocument, presidentialLabel } from '../src/lib/pulse/federalRegister.js';
import { tagPresidentialDocument, tagDocument, NOT_TRADE_POLICY_RE } from '../src/lib/pulse/tag.js';
import { pickExact, toParty } from '../src/lib/gleif.js';
import { parseIndicator } from '../src/lib/refresh/worldBank.js';

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

const YIELD_XML = `<feed><entry><content type="application/xml"><m:properties>
<d:Id m:type="Edm.Int32">328</d:Id>
<d:NEW_DATE m:type="Edm.DateTime">2026-10-01T00:00:00</d:NEW_DATE>
<d:BC_3MONTH m:type="Edm.Double">3.95</d:BC_3MONTH>
<d:BC_2YEAR m:type="Edm.Double">3.60</d:BC_2YEAR>
<d:BC_10YEAR m:type="Edm.Double">4.10</d:BC_10YEAR>
<d:BC_30YEAR m:type="Edm.Double">4.70</d:BC_30YEAR>
</m:properties></content></entry></feed>`;

test('parses the Treasury yield curve entries', () => {
  const rows = parseYieldXml(YIELD_XML);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.find((r) => r.id === 'UST:10Y'), { id: 'UST:10Y', date: '2026-10-01', value: 4.1 });
});

test('yield parser ignores entries without a date or value', () => {
  assert.equal(parseYieldXml('<m:properties><d:BC_10YEAR>4.1</d:BC_10YEAR></m:properties>').length, 0);
  assert.equal(parseYieldXml('<m:properties><d:NEW_DATE m:type="Edm.DateTime">2026-10-01T00:00:00</d:NEW_DATE></m:properties>').length, 0);
});

const TIC = [
  'Table 5: Major Foreign Holders of Treasury Securities\t\t',
  '',
  'Country\t2026-07\t2026-06',
  'Japan\t1103.9\t1116.7',
  'China, Mainland\t618.0\t633.4',
  'Atlantis\t5.0\t4.0',
  'All Other\t1842.4\t1850.3',
  'Grand Total\t9248.1\t9298.5',
  'Of Which: Foreign Official\t3773.1\t3778.1',
].join('\n');

test('parses the TIC holders table by country and totals', () => {
  const { meta, rows } = parseTicTable(TIC);
  assert.deepEqual(meta.map((m) => m.id).sort(), ['TIC:CN', 'TIC:JP', 'TIC:OFFICIAL', 'TIC:TOTAL']);
  assert.deepEqual(rows.find((r) => r.id === 'TIC:JP' && r.date === '2026-06-01'), { id: 'TIC:JP', date: '2026-06-01', value: 1116.7 });
  assert.equal(rows.length, 8);
});

test('TIC parser skips unknown names instead of guessing a code', () => {
  assert.ok(!parseTicTable(TIC).rows.some((r) => r.id.includes('Atlantis')));
});

test('TIC parser rejects a changed layout', () => {
  assert.throws(() => parseTicTable('nothing useful here'), /shape changed/);
});

const PCPS = [
  'STRUCTURE[;],STRUCTURE_ID,ACTION,COUNTRY,INDICATOR,DATA_TRANSFORMATION,FREQUENCY,TIME_PERIOD,OBS_VALUE',
  'dataflow,IMF.RES:PCPS(9.0.0),R,G001,POILBRE,USD,M,2026-M09,102.018',
  'dataflow,IMF.RES:PCPS(9.0.0),R,G001,PGOLD,USD,M,2026-M08,4419.4',
  'dataflow,IMF.RES:PCPS(9.0.0),R,G001,PNOTREAL,USD,M,2026-M09,1',
  'dataflow,IMF.RES:PCPS(9.0.0),R,G001,PGOLD,USD,Q,2026-Q3,4300',
].join('\n');

test('parses IMF commodity prices and drops unknown or non-monthly rows', () => {
  const rows = parsePcpsCsv(PCPS);
  assert.deepEqual(rows, [
    { id: 'IMF:POILBRE', date: '2026-09-01', value: 102.018 },
    { id: 'IMF:PGOLD', date: '2026-08-01', value: 4419.4 },
  ]);
});

test('commodity parser rejects a changed CSV shape', () => {
  assert.throws(() => parsePcpsCsv('a,b\n1,2'), /shape changed/);
});

test('keeps trade-related presidential documents and drops commemorations', () => {
  assert.ok(isTradeRelevantPresidentialDocument('Adjusting Imports of Polysilicon and Its Derivatives Into the United States'));
  assert.ok(isTradeRelevantPresidentialDocument('Continuation of the National Emergency With Respect to Export Control Regulations'));
  assert.ok(!isTradeRelevantPresidentialDocument('Columbus Day, 2026'));
  assert.ok(!isTradeRelevantPresidentialDocument('World Trade Week, 2026'));
  assert.ok(!isTradeRelevantPresidentialDocument('Declaring a National Emergency at the Southern Border of the United States'));
  assert.ok(!isTradeRelevantPresidentialDocument('Continuation of the National Emergency With Respect to Certain Terrorist Attacks'));
});

test('tags presidential documents from the presidential title wording', () => {
  assert.equal(tagPresidentialDocument({ title: 'Adjusting Imports of Unmanned Aircraft Systems Into the United States', abstract: null }), 'Tariff');
  assert.equal(tagPresidentialDocument({ title: 'Modifying the Scope of Products of Canada Subject to the Additional Duties', abstract: null }), 'Tariff');
  assert.equal(tagPresidentialDocument({ title: 'Continuation of the National Emergency With Respect to Syria', abstract: null }), 'Sanctions');
  assert.equal(tagPresidentialDocument({ title: 'Columbus Day, 2026', abstract: null }), 'Other');
  assert.equal(tagPresidentialDocument({ title: 'Continuing the Suspension of Duty-Free De Minimis Treatment for All Countries', abstract: null }), 'Tariff');
  assert.equal(tagPresidentialDocument({ title: 'Addressing the Threat to National Security From Imports of Copper', abstract: null }), 'Tariff');
});

test('labels a presidential document by its real number', () => {
  assert.equal(presidentialLabel({ subtype: 'Proclamation', executive_order_number: null, proclamation_number: '11073' }), 'Proclamation 11073');
  assert.equal(presidentialLabel({ subtype: 'Executive Order', executive_order_number: '14435', proclamation_number: null }), 'Executive Order 14435');
  assert.equal(presidentialLabel({ subtype: 'Notice', executive_order_number: null, proclamation_number: null }), null);
});

const rec = (id: string, name: string, status = 'ACTIVE') => ({ id, attributes: { entity: { legalName: { name }, legalAddress: { country: 'DE' }, status } } });

test('GLEIF lookup uses only an exact registered-name match', () => {
  const records = [rec('A', 'Volkswagen Financial Services Schweiz AG'), rec('B', 'Volkswagen Financial Services AG')];
  assert.equal(pickExact('volkswagen financial services ag', records)?.id, 'B');
  assert.equal(pickExact('Volkswagen Financial', records), null);
  assert.equal(pickExact('', records), null);
});

test('GLEIF prefers an active record over a lapsed one with the same name', () => {
  assert.equal(pickExact('Acme Ltd', [rec('OLD', 'Acme Ltd', 'INACTIVE'), rec('NEW', 'Acme Ltd')])?.id, 'NEW');
});

test('GLEIF record becomes a party only when it has a name', () => {
  assert.deepEqual(toParty(rec('X', 'Foo GmbH')), { lei: 'X', name: 'Foo GmbH', country: 'DE' });
  assert.equal(toParty({ id: 'Y' }), null);
  assert.equal(toParty(null), null);
});

test('parses World Bank indicator rows and skips empty values', () => {
  const body = [{ page: 1 }, [
    { country: { id: 'DE' }, date: '2025', value: 83491249 },
    { country: { id: 'XX' }, date: '2025', value: null },
    { country: { id: 'FR' }, date: '2024', value: 68000000 },
  ]];
  assert.deepEqual(parseIndicator(body), [{ country: 'DE', year: '2025', value: 83491249 }, { country: 'FR', year: '2024', value: 68000000 }]);
});

test('World Bank parser rejects a changed response shape', () => {
  assert.throws(() => parseIndicator({ message: 'error' }), /shape changed/);
});

test('Section 301 continuation notices are tariffs, and routine notices are skipped', () => {
  assert.equal(tagDocument({ title: "Continuation of Actions: China's Acts, Policies, and Practices Related to Technology Transfer", abstract: null, agencySlugs: [] }), 'Tariff');
  assert.ok(NOT_TRADE_POLICY_RE.test('Accreditation and Approval of Intertek USA, Inc. (Chelsea, MA), as a Commercial Gauger and Laboratory'));
  assert.ok(NOT_TRADE_POLICY_RE.test('Advance Traveler Information for Rail'));
  assert.ok(!NOT_TRADE_POLICY_RE.test('Adjusting Imports of Copper'));
});

if (failures) {
  console.error(`\n${failures} FAIL`);
  process.exit(1);
}
