// Export license decision (src/lib/exportLicense.ts). Pure rule tests plus, when the seeded local database exists, an exhaustive pass over every
// destination x ECCN in the curated data, checked against a separately written oracle. No network, no model. Run: npm run test:unit

import assert from 'node:assert/strict';
import { decideExportLicense, type LicenseInput } from '../src/lib/exportLicense.js';
import { openLocalDb } from './accuracy/d1shim.js';

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

const base: LicenseInput = { country: 'DE', hardStop: false, coverage: { status: 'curated', notes: null }, eccn: null, chartRows: [{ reason_for_control: 'NS1' }, { reason_for_control: 'NS2' }] };
const eccn = (code: string, reasons: string[], exceptions: string[] = []) => ({ eccn: code, reasonsForControl: reasons, licenseExceptions: exceptions });

test('a denied-party hard stop wins over everything', () => {
  for (const status of ['curated', 'comprehensive_embargo', 'broad_restriction_746_5', 'not_curated'] as const) {
    assert.equal(decideExportLicense({ ...base, hardStop: true, coverage: { status, notes: null }, eccn: eccn('EAR99', []) }).requirement, 'License Required');
  }
});
test('a comprehensive embargo needs a license even for EAR99', () => {
  assert.equal(decideExportLicense({ ...base, country: 'CU', coverage: { status: 'comprehensive_embargo', notes: 'Cuba' }, eccn: eccn('EAR99', []) }).requirement, 'License Required');
  assert.equal(decideExportLicense({ ...base, country: 'IR', coverage: { status: 'comprehensive_embargo', notes: 'Iran' }, eccn: null }).requirement, 'License Required');
});
test('Russia-type restriction with an uncontrolled item is Insufficient Data, never NLR', () => {
  const cov = { status: 'broad_restriction_746_5' as const, notes: 'Russia' };
  assert.equal(decideExportLicense({ ...base, country: 'RU', coverage: cov, eccn: eccn('EAR99', []) }).requirement, 'Insufficient Data');
  assert.equal(decideExportLicense({ ...base, country: 'RU', coverage: cov, eccn: null }).requirement, 'Insufficient Data');
});
test('Russia-type restriction with a controlled item needs a license', () => {
  assert.equal(decideExportLicense({ ...base, country: 'RU', coverage: { status: 'broad_restriction_746_5', notes: 'Russia' }, eccn: eccn('5A992', ['AT']) }).requirement, 'License Required');
});
test('EAR99 to a curated destination is NLR', () => {
  assert.equal(decideExportLicense({ ...base, eccn: eccn('EAR99', []) }).requirement, 'NLR');
});
test('an uncurated destination with a controlled item is Insufficient Data', () => {
  assert.equal(decideExportLicense({ ...base, coverage: null, eccn: eccn('5A002', ['NS', 'AT']) }).requirement, 'Insufficient Data');
  assert.equal(decideExportLicense({ ...base, coverage: { status: 'not_curated', notes: null }, eccn: eccn('5A002', ['NS']) }).requirement, 'Insufficient Data');
});
test('a chart-marked reason with exceptions gives License Exception May Apply', () => {
  const d = decideExportLicense({ ...base, eccn: eccn('5A002', ['NS'], ['ENC']) });
  assert.equal(d.requirement, 'License Exception May Apply');
  assert.equal(d.matchedReason, 'NS');
});
test('a chart-marked reason without exceptions gives License Required', () => {
  assert.equal(decideExportLicense({ ...base, eccn: eccn('3A001', ['NS']) }).requirement, 'License Required');
});
test('a reason whose chart column is not verified for the destination is Insufficient Data, not NLR', () => {
  const d = decideExportLicense({ ...base, eccn: eccn('1C350', ['CB', 'AT']) });
  assert.equal(d.requirement, 'Insufficient Data');
  assert.match(d.note, /CB/);
});
test('an anti-terrorism-only item to a curated ally is NLR', () => {
  assert.equal(decideExportLicense({ ...base, eccn: eccn('5A992', ['AT']) }).requirement, 'NLR');
});
test('a matched reason still decides even when another reason is unverified', () => {
  assert.equal(decideExportLicense({ ...base, eccn: eccn('6A003', ['NS', 'RS', 'AT']) }).requirement, 'License Required');
});
test('NS1 and NS2 both count as the NS reason', () => {
  assert.equal(decideExportLicense({ ...base, chartRows: [{ reason_for_control: 'NS2' }], eccn: eccn('3A001', ['NS']) }).requirement, 'License Required');
});

// Exhaustive pass over the curated data.
const db = openLocalDb();
if (!db) {
  console.log('skip exhaustive pass: no seeded local database (run wrangler dev once and load the seed data)');
} else {
  const eccns = db.prepare('SELECT eccn, reasons_for_control, license_exceptions FROM eccn_entries').all() as { eccn: string; reasons_for_control: string; license_exceptions: string | null }[];
  const coverages = db.prepare('SELECT country_code, status, notes FROM country_chart_coverage').all() as { country_code: string; status: 'curated' | 'comprehensive_embargo' | 'broad_restriction_746_5' | 'not_curated'; notes: string | null }[];
  const chart = db.prepare('SELECT country_code, reason_for_control FROM country_chart').all() as { country_code: string; reason_for_control: string }[];
  test('exhaustive: every destination x ECCN agrees with an independent oracle', () => {
    let checked = 0;
    for (const cov of coverages) {
      const rows = chart.filter((r) => r.country_code === cov.country_code);
      for (const e of eccns) {
        const reasons = JSON.parse(e.reasons_for_control || '[]') as string[];
        const exceptions = JSON.parse(e.license_exceptions || '[]') as string[];
        const verifiedSet = new Set([...chart.map((x) => x.reason_for_control.replace(/\d+$/, '')), 'AT']);
        const got = decideExportLicense({ country: cov.country_code, hardStop: false, coverage: cov, eccn: { eccn: e.eccn, reasonsForControl: reasons, licenseExceptions: exceptions }, chartRows: rows, verifiedReasons: new Set(chart.map((x) => x.reason_for_control.replace(/\d+$/, ''))) }).requirement;
        const uncontrolled = e.eccn === 'EAR99' || reasons.length === 0;
        const marked = reasons.some((r) => rows.some((x) => x.reason_for_control.startsWith(r)));
        let want: string;
        if (cov.status === 'comprehensive_embargo') want = 'License Required';
        else if (cov.status === 'broad_restriction_746_5') want = uncontrolled ? 'Insufficient Data' : 'License Required';
        else if (uncontrolled) want = 'NLR';
        else if (cov.status === 'not_curated') want = 'Insufficient Data';
        else if (marked) want = exceptions.length ? 'License Exception May Apply' : 'License Required';
        else if (reasons.some((r) => !verifiedSet.has(r))) want = 'Insufficient Data';
        else want = 'NLR';
        assert.equal(got, want, `${cov.country_code} x ${e.eccn}: got ${got}, expected ${want}`);
        checked++;
      }
    }
    assert.ok(checked > 0, 'no destination x ECCN pairs were checked');
    console.log(`     ${checked} pairs checked (${coverages.length} destinations x ${eccns.length} ECCNs)`);
  });
  test('no embargoed destination is ever NLR for any ECCN', () => {
    for (const cov of coverages.filter((c) => c.status === 'comprehensive_embargo')) {
      for (const e of eccns) {
        const d = decideExportLicense({ country: cov.country_code, hardStop: false, coverage: cov, eccn: { eccn: e.eccn, reasonsForControl: JSON.parse(e.reasons_for_control || '[]'), licenseExceptions: [] }, chartRows: [] });
        assert.notEqual(d.requirement, 'NLR', `${cov.country_code} x ${e.eccn}`);
      }
    }
  });
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
