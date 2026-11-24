// The Dashboard's trade, tariff and power builder: grouping, top lists, plain program names, and sources that are missing. No network. Run: npm run test:unit
import assert from 'node:assert/strict';
import { buildPower, programLabel, type PowerInputs } from '../src/lib/pulse/dashboardPower.js';

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
const base: PowerInputs = { now: new Date('2026-11-23T12:00:00Z'), summary: null, tempo: null, csms: null, measures: null, nato: null, sanctionCounts: null, wro: null, opinion: null, power: null };

test('with no data every panel is empty', () => {
  const p = buildPower(base);
  assert.equal(p.notices, null);
  assert.equal(p.tariffs, null);
  assert.equal(p.military, null);
  assert.equal(p.nato, null);
  assert.equal(p.sanctions, null);
  assert.deepEqual(p.usChina, []);
});

test('forced-labor tariffs group countries by rate, highest first', () => {
  const p = buildPower({ ...base, summary: { last30: 1, prior30: 1, trendPct: 0, countryTariffs: { forcedLabor: [{ country: 'VN', ratePct: 10 }, { country: 'AE', ratePct: 12.5 }, { country: 'AO', ratePct: 12.5 }], capped: [1, 2] } } });
  assert.deepEqual(p.tariffs?.groups, [{ ratePct: 12.5, countries: ['AE', 'AO'] }, { ratePct: 10, countries: ['VN'] }]);
  assert.equal(p.tariffs?.cappedCount, 2);
});

test('military spending: top ten by dollars with the world total and U.S. and China shares of GDP', () => {
  const dist = Array.from({ length: 12 }, (_, k) => [`C${k}`, (k + 1) * 10] as [string, number]);
  const p = buildPower({ ...base, power: { indicators: [
    { id: 'military_usd', label: 'm', unit: 'usd', latestYear: 2025, standings: {}, distribution: dist },
    { id: 'military_gdp', label: 'g', unit: 'pct', latestYear: 2025, standings: { US: { value: 3.1, rank: 1, of: 2 }, CN: { value: 1.7, rank: 2, of: 2 } }, distribution: [] },
  ] } });
  assert.equal(p.military?.top.length, 10);
  assert.equal(p.military?.top[0].cc, 'C11');
  assert.equal(p.military?.worldUsd, 780);
  assert.equal(p.military?.usPctGdp, 3.1);
});

test('NATO rows use each ally\'s latest year and count who meets 2 percent', () => {
  const p = buildPower({ ...base, nato: { countries: { PL: { points: [['2024-12-31', 4.1], ['2025-12-31', 4.5]], asOf: '2025-08-28' }, DE: { points: [['2025-12-31', 1.9]], asOf: '2025-08-28' }, FR: { points: [], asOf: 'x' } } } });
  assert.deepEqual(p.nato?.rows.map((r) => [r.cc, r.pct, r.year]), [['PL', 4.5, '2025'], ['DE', 1.9, '2025']]);
  assert.equal(p.nato?.metTarget, 1);
});

test('measures are named in plain words and ranked by how many product lines they cover', () => {
  const p = buildPower({ ...base, measures: { overlays: [
    { program: 'sec232_steel', min_rate_pct: 25, max_rate_pct: 50, line_count: 5, country_count: 0, effective_date: '2025-03-12' },
    { program: 'sec301_china', min_rate_pct: 7, max_rate_pct: 100, line_count: 9000, country_count: 1, effective_date: '2018-07-06' },
    { program: 'sec301_china', min_rate_pct: 7.5, max_rate_pct: 7.5, line_count: 100, country_count: 1, effective_date: '2019-09-01' },
    { program: 'sec301_china_coverage', min_rate_pct: 0, max_rate_pct: 0, line_count: 1, country_count: 1, effective_date: '2026-11-22' },
    { program: 'empty', min_rate_pct: 0, max_rate_pct: 0, line_count: 0, country_count: 0, effective_date: '' },
  ] } });
  assert.deepEqual(p.measures.map((m) => m.label), ['Section 301: China (2018 onward)', 'Section 232: steel']);
  assert.deepEqual([p.measures[0].lines, p.measures[0].minPct, p.measures[0].maxPct, p.measures[0].since], [9100, 7, 100, '2018-07-06']);
  assert.equal(programLabel('sec999_new_thing'), 'Section 999: new thing');
});

test('sanctions: top countries and which list copies are stale', () => {
  const p = buildPower({ ...base, sanctionCounts: { total: 10, totals: { sdn: 5, csl: 3, un: 1, uk: 1 }, countries: [{ country: 'RU', count: 7 }, { country: 'IR', count: 2 }], lists: [{ label: 'SDN', state: 'ok', age_days: 1, has_rows: true }, { label: 'UK', state: 'stale', age_days: 40, has_rows: true }] } });
  assert.equal(p.sanctions?.top[0].cc, 'RU');
  assert.deepEqual(p.sanctions?.lists.map((l) => l.stale), [false, true]);
});

test('opinion needs both the U.S. and China in the latest year', () => {
  const s = [{ subject: 'US', year: 2026, publishedMedian: 37, countriesInMedian: 36 }, { subject: 'CN', year: 2026, publishedMedian: 51, countriesInMedian: 37 }, { subject: 'US', year: 2025, publishedMedian: 49, countriesInMedian: 24 }];
  assert.deepEqual(buildPower({ ...base, opinion: { surveys: s } }).opinion, { year: 2026, us: 37, cn: 51, countries: 36, africa: null });
  assert.equal(buildPower({ ...base, opinion: { surveys: [s[0]] } }).opinion, null);
});

if (failures) {
  console.error(`${failures} test(s) failed`);
  process.exit(1);
}
console.log('All dashboard power tests passed');
