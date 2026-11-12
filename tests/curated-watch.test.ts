// Change watcher, staleness, entry fees and overlay dates: the parts that keep the calculator honest as rules change, with no network and
// no model. Run: npm run test:unit

import assert from 'node:assert/strict';
import { programsFor, findNewAlerts, staleness, describeAlerts, programsForOverlays, latestAmendment, ecfrAlerts, ECFR_PARTS, type WatchedAction } from '../src/lib/curatedWatch.js';
import { computeEntryFees, FEE_SCHEDULE } from '../src/lib/customsFees.js';
import { splitOverlaysByDate } from '../src/lib/dutyStack.js';
import type { TariffOverlayRow } from '../src/lib/db.js';

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

const action = (over: Partial<WatchedAction>): WatchedAction => ({
  document_number: '2026-99999',
  title: 'A notice',
  abstract: null,
  agency: 'Executive Office of the President',
  doc_type: 'PRESIDENTIAL_DOCUMENT',
  publication_date: '2026-10-15',
  effective_on: null,
  html_url: 'https://www.federalregister.gov/d/2026-99999',
  ...over,
});

test('Section 232 proclamations are matched', () => {
  assert.deepEqual(programsFor(action({ title: 'Adjusting Imports of Aluminum, Steel, and Copper Into the United States' })), ['sec232']);
  assert.ok(programsFor(action({ title: 'Inclusions process for Section 232 steel derivative products', doc_type: 'NOTICE' })).includes('sec232'));
});
test('Section 301 and 338 notices are matched', () => {
  assert.ok(programsFor(action({ title: 'Notice of Product Exclusions: China’s Acts, Policies, and Practices (Section 301)', doc_type: 'NOTICE', agency: 'Office of the United States Trade Representative' })).includes('sec301'));
  assert.ok(programsFor(action({ title: 'Imposing Additional Duties Under Section 338 on Canada' })).includes('sec338'));
});
test('USMCA and user-fee notices are matched', () => {
  assert.ok(programsFor(action({ title: 'USMCA Rules of Origin: Annual Review', doc_type: 'NOTICE' })).includes('usmca'));
  assert.ok(programsFor(action({ title: 'Customs User Fees To Be Adjusted for Fiscal Year 2028', doc_type: 'NOTICE', agency: 'U.S. Customs and Border Protection' })).includes('customs_fees'));
});
test('a BIS rule on the Commerce Control List is an export-controls alert; an Entity List addition is not', () => {
  const bis = 'Bureau of Industry and Security';
  assert.deepEqual(programsFor(action({ title: 'Revisions to License Requirements and the Commerce Control List', doc_type: 'RULE', agency: bis })), ['export_controls']);
  assert.deepEqual(programsFor(action({ title: 'Additions to the Entity List', doc_type: 'RULE', agency: bis })), []);
});
test('antidumping cases and USMCA panel reviews are not alerts', () => {
  assert.deepEqual(programsFor(action({ title: 'Aluminum Foil From Armenia, Brazil, Oman; Institution of Five-Year Reviews', doc_type: 'NOTICE', abstract: 'steel imports' })), []);
  assert.deepEqual(programsFor(action({ title: 'United States-Mexico-Canada Agreement (USMCA), Article 10.12; Binational Panel Review', doc_type: 'NOTICE' })), []);
});
test('a proposed rule and an unrelated notice raise nothing', () => {
  assert.deepEqual(programsFor(action({ title: 'Section 232 inclusions', doc_type: 'PROPOSED_RULE' })), []);
  assert.deepEqual(programsFor(action({ title: 'Meeting of the advisory committee', doc_type: 'NOTICE' })), []);
});

test('only notices newer than the program data raise alerts, and known ones are not repeated', () => {
  const a = action({ document_number: 'new', title: 'Adjusting Imports of Steel', publication_date: '2026-10-15' });
  const old = action({ document_number: 'old', title: 'Adjusting Imports of Steel', publication_date: '2026-09-01' });
  const same = action({ document_number: 'same', title: 'Adjusting Imports of Steel', publication_date: '2026-09-22' });
  const baselines = { sec232: '2026-09-22' };
  assert.deepEqual(findNewAlerts([a, old, same], baselines, new Set()).map((x) => x.document_number), ['new']);
  assert.equal(findNewAlerts([a], baselines, new Set(['new:sec232'])).length, 0);
});
test('a program with no loaded data raises no alert', () => {
  assert.equal(findNewAlerts([action({ title: 'Adjusting Imports of Steel' })], {}, new Set()).length, 0);
});
test('a notice that names two programs raises one alert for each', () => {
  const both = action({ title: 'Section 232 and Section 301 actions' });
  const programs = findNewAlerts([both], { sec232: '2026-01-01', sec301: '2026-01-01' }, new Set()).map((x) => x.program).sort();
  assert.deepEqual(programs, ['sec232', 'sec301']);
});

test('staleness thresholds', () => {
  assert.equal(staleness('x', '2026-09-22', '2026-11-03').level, 'ok'); // 42 days
  assert.equal(staleness('x', '2026-09-22', '2026-11-10').level, 'aging'); // 49 days
  assert.equal(staleness('x', '2026-09-22', '2027-01-01').level, 'stale'); // 101 days
});

test('programs a case touches', () => {
  assert.deepEqual(programsForOverlays(['sec232_steel', 'sec232_metals_country_cap'], 'DE'), ['sec232']);
  assert.deepEqual(programsForOverlays([], 'CA').sort(), ['usmca']);
  assert.deepEqual(programsForOverlays([], 'CN'), ['sec301']);
});
test('alert text names the program, date and link', () => {
  const [issue] = describeAlerts([{ program: 'sec232', title: 'Adjusting Imports of Steel', publication_date: '2026-10-15', html_url: 'https://example.gov/x' }]);
  assert.match(issue, /Section 232 duties/);
  assert.match(issue, /2026-10-15/);
  assert.match(issue, /https:\/\/example\.gov\/x/);
});

// Entry fees
const fee = (over: Partial<Parameters<typeof computeEntryFees>[0]>) => computeEntryFees({ valueUsd: 10_000, date: '2026-11-03', country: 'DE', usmcaQualifies: null, ...over });
const mpf = (over: Partial<Parameters<typeof computeEntryFees>[0]>) => fee(over)[0];

test('MPF is 0.3464% of value inside the yearly limits', () => {
  assert.equal(mpf({ valueUsd: 10_000 }).amount_usd, 34.64); // fiscal year 2027: 34.58 minimum, so 34.64 stands
  assert.equal(mpf({ valueUsd: 3000 }).amount_usd, 34.58); // 10.39 is under the minimum
  assert.equal(mpf({ valueUsd: 1_000_000 }).amount_usd, 670.86);
});
test('the limits follow the fiscal year of the entry date', () => {
  assert.equal(mpf({ valueUsd: 3000, date: '2026-09-30' }).amount_usd, 33.58);
  assert.equal(mpf({ valueUsd: 1_000_000, date: '2026-09-30' }).amount_usd, 651.5);
});
test('past the last known fiscal year the app gives no dollar figure', () => {
  assert.equal(mpf({ date: '2027-10-01' }).amount_usd, null);
  assert.match(mpf({ date: '2027-10-01' }).basis, /only known through/);
  assert.equal(FEE_SCHEDULE.length, 2);
});
test('USMCA-originating goods pay no MPF; unknown qualification is flagged, not assumed', () => {
  assert.equal(mpf({ country: 'CA', usmcaQualifies: true }).amount_usd, 0);
  assert.match(mpf({ country: 'CA', usmcaQualifies: null }).basis, /zero if the goods qualify/);
  assert.equal(mpf({ country: 'DE', usmcaQualifies: true }).amount_usd, 34.64); // USMCA does not apply to Germany
});
test('low-value and informal entries are not given a computed MPF', () => {
  assert.equal(mpf({ valueUsd: 500 }).amount_usd, 0);
  assert.equal(mpf({ valueUsd: 1500 }).amount_usd, null);
  assert.equal(mpf({ valueUsd: null }).amount_usd, null);
});
test('HMF is shown as conditional and never added', () => {
  const hmf = fee({ valueUsd: 10_000 })[1];
  assert.equal(hmf.amount_usd, null);
  assert.match(hmf.basis, /12\.50 dollars/);
});

// Overlay dates
const row = (over: Partial<TariffOverlayRow>): TariffOverlayRow =>
  ({ id: 1, program: 'sec232_steel', hts_pattern: '72', country_scope: null, rate_pct: 50, rate_type: 'ad_valorem', legal_basis: '', effective_date: '2026-06-08', expiration_date: null, exclusions: null, stacking_rule: null, source_url: '', source_tier: 1, last_updated: '2026-09-22', data_as_of: '2026-09-22', ...over }) as TariffOverlayRow;

test('overlay rows are in force only between their dates', () => {
  const rows = [row({ id: 1 }), row({ id: 2, effective_date: '2026-12-01' }), row({ id: 3, expiration_date: '2026-10-31' }), row({ id: 4, expiration_date: '2026-11-03' })];
  const { active, inactive } = splitOverlaysByDate(rows, '2026-11-03');
  assert.deepEqual(active.map((r) => r.id), [1, 4]);
  assert.deepEqual(inactive.map((i) => i.row.id), [2, 3]);
  assert.match(inactive[0].reason, /takes effect 2026-12-01/);
  assert.match(inactive[1].reason, /expired 2026-10-31/);
});

// eCFR amendment dates
test('the newest amendment date is read from an eCFR versions response', () => {
  assert.equal(latestAmendment({ content_versions: [{ amendment_date: '2025-09-30' }, { amendment_date: '2026-08-28' }, { amendment_date: '2024-01-02' }] }), '2026-08-28');
});
test('an empty or malformed eCFR response gives no date', () => {
  assert.equal(latestAmendment(null), null);
  assert.equal(latestAmendment({}), null);
  assert.equal(latestAmendment({ content_versions: [] }), null);
  assert.equal(latestAmendment({ content_versions: [{ amendment_date: 'soon' }, {}] }), null);
});
test('only an amendment newer than the table raises an alert, once', () => {
  const part = ECFR_PARTS.find((p) => p.part === 774)!;
  const base = { ear: '2026-09-22' };
  const old = ecfrAlerts([{ ...part, latest: '2026-08-28' }], { ecfr_ear: base.ear }, new Set());
  assert.equal(old.length, 0);
  const fresh = ecfrAlerts([{ ...part, latest: '2026-10-30' }], { ecfr_ear: base.ear }, new Set());
  assert.equal(fresh.length, 1);
  assert.equal(fresh[0].program, 'ecfr_ear');
  assert.match(fresh[0].title, /Commerce Control List.*2026-10-30/);
  assert.equal(ecfrAlerts([{ ...part, latest: '2026-10-30' }], { ecfr_ear: base.ear }, new Set([`${fresh[0].document_number}:ecfr_ear`])).length, 0);
});
test('the fee regulations are checked against the fee schedule date, not the export-control date', () => {
  const part = ECFR_PARTS.find((p) => p.part === 24)!;
  assert.equal(part.program, 'ecfr_fees');
  assert.equal(ecfrAlerts([{ ...part, latest: '2026-10-01' }], { ecfr_ear: '2026-09-22', ecfr_fees: '2026-11-03' }, new Set()).length, 0);
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
