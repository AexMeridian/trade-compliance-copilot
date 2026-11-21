// Export license decision (src/lib/exportLicense.ts). Pure rule tests, a check of migration 0032's ECCN rows, and, when the seeded local database
// exists, an exhaustive pass over every destination x ECCN in the curated data checked against a separately written oracle. No network, no model.
// Run: npm run test:unit

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { decideExportLicense, parseReason, type LicenseInput } from '../src/lib/exportLicense.js';
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
  assert.equal(decideExportLicense({ ...base, country: 'RU', coverage: { status: 'broad_restriction_746_5', notes: 'Russia' }, eccn: eccn('5A992', ['AT1']) }).requirement, 'License Required');
});
test('an uncurated destination with a controlled item is Insufficient Data', () => {
  assert.equal(decideExportLicense({ ...base, coverage: null, eccn: eccn('5A002', ['NS1', 'AT1']) }).requirement, 'Insufficient Data');
  assert.equal(decideExportLicense({ ...base, coverage: { status: 'not_curated', notes: null }, eccn: eccn('5A002', ['NS1']) }).requirement, 'Insufficient Data');
});
test('a whole-entry chart column marked for the destination with an exception is "Possible exception: verify"', () => {
  const d = decideExportLicense({ ...base, chartRows: [{ reason_for_control: 'NS1' }], eccn: eccn('5A002', ['NS1'], ['ENC']) });
  assert.equal(d.requirement, 'Possible exception: verify');
  assert.equal(d.matchedReason, 'NS Column 1');
  assert.match(d.note, /not checked the country group, paragraph/);
});
test('a whole-entry chart column marked with no exception is License Required', () => {
  assert.equal(decideExportLicense({ ...base, eccn: eccn('3A001', ['NS2']) }).requirement, 'License Required');
});
test('columns are compared exactly: 1C350 (CB2) to a destination marked only CB1 is not License Required', () => {
  const d = decideExportLicense({
    ...base,
    verifiedReasons: new Set(['NS', 'CB', 'AT']),
    chartRows: [{ reason_for_control: 'CB1' }, { reason_for_control: 'NS1' }],
    eccn: eccn('1C350', ['CB2', 'CW?', 'AT?']),
  });
  assert.notEqual(d.requirement, 'License Required');
  assert.equal(d.requirement, 'Insufficient Data');
  assert.match(d.note, /CW/);
});
test('3A001 to a destination marked NS Column 1 only is not decided by NS1 (paragraph-specific) and offers no exception', () => {
  const d = decideExportLicense({
    ...base,
    verifiedReasons: new Set(['NS', 'RS', 'MT', 'NP', 'AT']),
    chartRows: [{ reason_for_control: 'NS1' }],
    eccn: eccn('3A001', ['NS2', 'NS1?', 'RS1?', 'RS?', 'MT1?', 'NP1?', 'AT1'], ['GBS']),
  });
  assert.equal(d.requirement, 'Insufficient Data');
  assert.match(d.note, /NS Column 1 \(applies only to some paragraphs\)/);
});
test('a family the chart data does not cover is "verify", not NLR', () => {
  const d = decideExportLicense({ ...base, cclComplete: true, eccn: eccn('1C350', ['CB2']) });
  assert.equal(d.requirement, 'Insufficient Data');
  assert.match(d.note, /chart not loaded/);
});
test('an anti-terrorism-only item to a curated ally is NLR only when the list is complete, else cannot confirm', () => {
  const input = { ...base, verifiedReasons: new Set(['NS', 'AT']), eccn: eccn('5A992', ['AT1']) };
  assert.equal(decideExportLicense({ ...input, cclComplete: true }).requirement, 'NLR');
  assert.equal(decideExportLicense(input).requirement, 'Insufficient Data');
});
test('EAR99 or no match is never NLR while the Commerce Control List here is partial', () => {
  for (const e of [eccn('EAR99', []), null]) {
    const d = decideExportLicense({ ...base, eccn: e });
    assert.equal(d.requirement, 'Insufficient Data');
    assert.match(d.note, /Cannot confirm/);
  }
  assert.equal(decideExportLicense({ ...base, eccn: eccn('EAR99', []), cclComplete: true }).requirement, 'NLR');
});
test('Syria: EAR99 is "Possible exception: verify" (SPP, 746.9(b)(1)); a CCL item still needs a license', () => {
  const sy = { status: 'comprehensive_embargo' as const, notes: 'Syria' };
  const ear99 = decideExportLicense({ ...base, country: 'SY', coverage: sy, eccn: eccn('EAR99', []) });
  assert.equal(ear99.requirement, 'Possible exception: verify');
  assert.match(ear99.note, /SPP/);
  assert.equal(decideExportLicense({ ...base, country: 'SY', coverage: sy, eccn: eccn('3A001', ['NS2']) }).requirement, 'License Required');
  assert.equal(decideExportLicense({ ...base, country: 'CU', coverage: { status: 'comprehensive_embargo', notes: 'Cuba' }, eccn: eccn('EAR99', []) }).requirement, 'License Required');
});
test('legacy reasons with no column are verified, never decided on the family alone', () => {
  assert.equal(decideExportLicense({ ...base, eccn: eccn('X', ['NS']) }).requirement, 'Insufficient Data');
});
test('reason parsing', () => {
  assert.deepEqual(parseReason('NS2'), { family: 'NS', column: '2', conditional: false });
  assert.deepEqual(parseReason('NS1?'), { family: 'NS', column: '1', conditional: true });
  assert.deepEqual(parseReason('RS?'), { family: 'RS', column: null, conditional: true });
  assert.deepEqual(parseReason('NS'), { family: 'NS', column: null, conditional: false });
});

// The migration that replaced the hand-written ECCN rows: every row must parse, and the known-wrong claims must be gone.
test('migration 0032: ECCN rows are well formed and the audit errors are gone', () => {
  const sql = readFileSync('migrations/0032_eccn_ecfr_verified_and_syria.sql', 'utf8');
  const mem = new DatabaseSync(':memory:');
  mem.exec(`CREATE TABLE eccn_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, eccn TEXT, category TEXT, product_group TEXT, description TEXT, reasons_for_control TEXT, license_exceptions TEXT, citation TEXT, source_url TEXT, source_tier INTEGER, last_updated TEXT);
    INSERT INTO eccn_entries (eccn, category, product_group, description, reasons_for_control, license_exceptions, citation, source_url, source_tier, last_updated) VALUES ('EAR99','N/A','N/A','x','[]','[]','c','u',1,'2026-09-22'), ('5A992','5','A','old','["AT"]','["MMTC","ENC"]','c','https://eccnfinder.com/x',3,'2026-09-22');
    CREATE TABLE country_chart_coverage (country_code TEXT PRIMARY KEY, country_name TEXT, status TEXT, notes TEXT, source_url TEXT, source_tier INTEGER, last_updated TEXT);
    INSERT INTO country_chart_coverage VALUES ('SY','Syria','comprehensive_embargo','Comprehensive embargo -- see 15 CFR 746.9.','u',1,'2026-09-22');`);
  mem.exec(sql);
  const rows = mem.prepare('SELECT * FROM eccn_entries').all() as { eccn: string; description: string; reasons_for_control: string; license_exceptions: string; source_url: string; source_tier: number; last_updated: string }[];
  const byCode = new Map(rows.map((r) => [r.eccn, r]));
  for (const code of ['EAR99', '3A001', '3A090', '4A003', '4A090', '5A002', '5D002', '5A992', '6A003', '1C350']) assert.ok(byCode.has(code), `missing ${code}`);
  for (const r of rows) {
    for (const reason of JSON.parse(r.reasons_for_control) as string[]) assert.match(reason, /^[A-Z]{2}\d?\??$/, `${r.eccn} reason ${reason}`);
    assert.ok(Array.isArray(JSON.parse(r.license_exceptions)));
    assert.equal(r.source_tier, 1);
    assert.ok(!r.source_url.includes('eccnfinder') && !r.source_url.includes('bis.gov/regulations/ear/742'), `${r.eccn} source_url`);
    assert.ok(r.last_updated >= '2026-11-01', `${r.eccn} last_updated`);
  }
  assert.ok(!rows.some((r) => r.license_exceptions.includes('MMTC') || r.license_exceptions.includes('TSU')), 'invented exceptions are gone');
  assert.deepEqual(JSON.parse(byCode.get('6A003')!.license_exceptions), [], '6A003: GBS is N/A');
  assert.ok((JSON.parse(byCode.get('6A003')!.reasons_for_control) as string[]).includes('NP1?'));
  assert.ok((JSON.parse(byCode.get('1C350')!.reasons_for_control) as string[]).includes('CW?'));
  assert.ok((JSON.parse(byCode.get('3A001')!.reasons_for_control) as string[]).includes('MT1?'));
  assert.ok(!/frequently-updated sub-area/.test(byCode.get('4A003')!.description));
  assert.match(byCode.get('4A003')!.description, /4A090/);
  assert.match(byCode.get('3A001')!.description, /3A090/);
  const sy = mem.prepare("SELECT notes FROM country_chart_coverage WHERE country_code = 'SY'").get() as { notes: string };
  assert.match(sy.notes, /SPP/);
});

// Exhaustive pass over the curated data (legacy column-less reasons and the new column reasons both go through the same oracle).
const db = openLocalDb();
if (!db) {
  console.log('skip exhaustive pass: no seeded local database (run wrangler dev once and load the seed data)');
} else {
  const eccns = db.prepare('SELECT eccn, reasons_for_control, license_exceptions FROM eccn_entries').all() as { eccn: string; reasons_for_control: string; license_exceptions: string | null }[];
  const coverages = db.prepare('SELECT country_code, status, notes FROM country_chart_coverage').all() as { country_code: string; status: 'curated' | 'comprehensive_embargo' | 'broad_restriction_746_5' | 'not_curated'; notes: string | null }[];
  const chart = db.prepare('SELECT country_code, reason_for_control FROM country_chart').all() as { country_code: string; reason_for_control: string }[];
  const families = new Set(chart.map((x) => x.reason_for_control.replace(/\d+$/, '')));
  test('exhaustive: every destination x ECCN agrees with an independent oracle', () => {
    let checked = 0;
    for (const cov of coverages) {
      const marks = chart.filter((r) => r.country_code === cov.country_code).map((r) => r.reason_for_control);
      for (const e of eccns) {
        const reasons = JSON.parse(e.reasons_for_control || '[]') as string[];
        const exceptions = JSON.parse(e.license_exceptions || '[]') as string[];
        const got = decideExportLicense({
          country: cov.country_code,
          hardStop: false,
          coverage: cov,
          eccn: { eccn: e.eccn, reasonsForControl: reasons, licenseExceptions: exceptions },
          chartRows: marks.map((m) => ({ reason_for_control: m })),
          verifiedReasons: families,
        }).requirement;
        const uncontrolled = e.eccn === 'EAR99' || reasons.length === 0;
        let want: string;
        if (cov.status === 'comprehensive_embargo') want = cov.country_code === 'SY' && uncontrolled ? 'Possible exception: verify' : 'License Required';
        else if (cov.status === 'broad_restriction_746_5') want = uncontrolled ? 'Insufficient Data' : 'License Required';
        else if (uncontrolled) want = 'Insufficient Data'; // the Commerce Control List here is partial: never NLR
        else if (cov.status === 'not_curated') want = 'Insufficient Data';
        else {
          const hit = reasons.some((r) => /^[A-Z]{2}\d+$/.test(r) && marks.includes(r));
          const open = reasons.some((r) => {
            const fam = r.slice(0, 2);
            if (/^[A-Z]{2}\d+$/.test(r)) return false;
            if (r.endsWith('?')) return true; // paragraph or country-group dependent
            return marks.some((m) => m.startsWith(fam)) || !families.has(fam); // legacy family-only reason
          });
          const conditionalHit = reasons.some((r) => /^[A-Z]{2}\d+\?$/.test(r) && marks.includes(r.slice(0, -1)));
          const unverifiedColumn = reasons.some((r) => /^[A-Z]{2}\d+\??$/.test(r) && !families.has(r.slice(0, 2)));
          if (hit) want = exceptions.length ? 'Possible exception: verify' : 'License Required';
          else if (open || conditionalHit || unverifiedColumn) want = 'Insufficient Data';
          else want = 'Insufficient Data'; // partial list: never NLR
        }
        assert.equal(got, want, `${cov.country_code} x ${e.eccn}: got ${got}, expected ${want}`);
        checked++;
      }
    }
    assert.ok(checked > 0, 'no destination x ECCN pairs were checked');
    console.log(`     ${checked} pairs checked (${coverages.length} destinations x ${eccns.length} ECCNs)`);
  });
  test('no embargoed destination is ever NLR for any ECCN, and nothing is NLR while the list is partial', () => {
    for (const cov of coverages) {
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
