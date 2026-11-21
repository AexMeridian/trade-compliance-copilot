// Deterministic tests for the Power profile's indicator pipeline: parsing World Bank responses, ranking, and request
// normalization. No network, no database. Run: npm run test:unit

import assert from 'node:assert/strict';
import { parseCountryList, parseSeries } from '../src/lib/refresh/powerIndicators.js';
import { buildIndicatorView, HARD_POWER_STALE_YEARS, normalizeCountries, parseStored, STALE_YEARS } from '../src/lib/power/compute.js';
import { INDICATORS, INDICATOR_IDS, sourceFor } from '../src/lib/power/indicators.js';

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

const countryList = [{ page: 1 }, [
  { id: 'USA', iso2Code: 'US', region: { id: 'NAC' } },
  { id: 'NAM', iso2Code: 'NA', region: { id: 'SSF' } }, // Namibia: its code is "NA", the aggregates' region code
  { id: 'CHN', iso2Code: 'CN', region: { id: 'EAS' } },
  { id: 'EMU', iso2Code: 'XC', region: { id: 'NA' } }, // aggregate (e.g. Euro area)
  { id: 'AFE', iso2Code: 'ZH', region: { id: 'NA' } },
]];
const countries = parseCountryList(countryList);

test('country list keeps real countries and drops aggregates, even Namibia whose code is NA', () => {
  assert.deepEqual([...countries].sort(), ['CN', 'NA', 'US']);
});

test('country list with the wrong shape throws instead of loading nothing', () => {
  assert.throws(() => parseCountryList({ message: 'error' }));
});

const row = (cc: string, date: string, value: number | null) => ({ country: { id: cc }, date, value });

test('series parsing sorts oldest first, skips empty values and aggregates', () => {
  const body = [{}, [row('US', '2023', 3), row('US', '2021', 1), row('US', '2022', null), row('XC', '2023', 99), row('CN', '2020', 5)]];
  assert.deepEqual(parseSeries(body, countries), { US: [[2021, 1], [2023, 3]], CN: [[2020, 5]] });
});

test('series parsing keeps only the newest 12 points', () => {
  const body = [{}, Array.from({ length: 15 }, (_, i) => row('US', String(2010 + i), i))];
  const out = parseSeries(body, countries);
  assert.equal(out.US.length, 12);
  assert.equal(out.US[0][0], 2013);
  assert.equal(out.US[11][0], 2024);
});

test('series parsing rejects a changed response shape', () => {
  assert.throws(() => parseSeries({ error: true }, countries));
});

test('indicator definitions are unique, complete and sourced', () => {
  assert.equal(new Set(INDICATOR_IDS).size, INDICATORS.length);
  const upstream = INDICATORS.filter((i) => i.provider !== 'derived');
  assert.equal(new Set(upstream.map((i) => `${i.provider}:${i.code}`)).size, upstream.length);
  for (const i of INDICATORS) {
    assert.ok(i.label && i.definition && i.caveat && i.higherIs, `${i.id} is missing text`);
    assert.ok(i.minCountries > 0);
  }
  assert.ok(INDICATORS.filter((i) => i.id.startsWith('wgi_')).every((i) => i.wbSource === 3), 'WGI series live in World Bank source 3');
});

const def = INDICATORS[0];
test('ranking puts the highest value first and reports the field size', () => {
  const view = buildIndicatorView(def, { A1: [[2024, 10]], B1: [[2024, 30]], C1: [[2024, 20]] }, ['C1', 'B1']);
  assert.equal(view.standings.B1?.rank, 1);
  assert.equal(view.standings.C1?.rank, 2);
  assert.equal(view.standings.C1?.of, 3);
  assert.deepEqual(view.distribution.map(([cc]) => cc), ['A1', 'C1', 'B1']); // ascending, for the dot plot
});

test('a country with no data is null, never zero, and does not affect the ranks', () => {
  const view = buildIndicatorView(def, { A1: [[2024, 10]], B1: [[2024, 30]] }, ['ZZ', 'A1']);
  assert.equal(view.standings.ZZ, null);
  assert.equal(view.standings.A1?.rank, 2);
  assert.equal(view.standings.A1?.of, 2);
  assert.deepEqual(view.series.ZZ, []);
});

test('a stale figure is shown by neither rank nor distribution, so old years are not compared with new ones', () => {
  const view = buildIndicatorView(def, { A1: [[2024, 10]], OLD: [[2024 - STALE_YEARS - 1, 99]] }, ['OLD']);
  assert.equal(view.standings.OLD, null);
  assert.equal(view.distribution.length, 1);
});

test('ties get distinct, stable ranks ordered by code', () => {
  const view = buildIndicatorView(def, { B1: [[2024, 5]], A1: [[2024, 5]] }, ['A1', 'B1']);
  assert.equal(view.standings.A1?.rank, 1);
  assert.equal(view.standings.B1?.rank, 2);
});

test('an empty indicator yields an empty, honest view', () => {
  const view = buildIndicatorView(def, {}, ['US']);
  assert.equal(view.latestYear, null);
  assert.equal(view.standings.US, null);
  assert.equal(view.distribution.length, 0);
});

test('stored json that is corrupt or malformed is treated as no data', () => {
  assert.deepEqual(parseStored('{not json'), {});
  assert.deepEqual(parseStored(null), {});
  assert.deepEqual(parseStored('{"US":[[2024,1],["x",2],[2023]],"CN":"bad"}'), { US: [[2024, 1]] });
});

test('country list normalization is case-insensitive, deduped, sorted and capped at four', () => {
  assert.deepEqual(normalizeCountries('cn, us,CN,in'), ['CN', 'IN', 'US']);
  assert.deepEqual(normalizeCountries('AA,BB,CC,DD,EE'), ['AA', 'BB', 'CC', 'DD']);
  assert.deepEqual(normalizeCountries('USA,1,,<script>,U S'), []);
  assert.deepEqual(normalizeCountries(undefined), []);
});

const hardDef = INDICATORS.find((i) => i.id === 'gdp_usd')!;
test('hard-power ranks use a one-year window, and the year of each ranked figure is reported', () => {
  assert.equal(HARD_POWER_STALE_YEARS, 1);
  const view = buildIndicatorView(hardDef, { A1: [[2025, 10]], B1: [[2024, 30]], OLD: [[2022, 99]] }, ['A1', 'B1', 'OLD']);
  assert.equal(view.standings.OLD, null);
  assert.equal(view.standings.B1?.rank, 1);
  assert.equal(view.standings.B1?.of, 2);
  assert.deepEqual(view.years, { A1: 2025, B1: 2024 });
});

test('hard-power ranks leave out dependencies, so "of N" counts economies', () => {
  const view = buildIndicatorView(hardDef, { US: [[2025, 5]], GI: [[2025, 50]], SX: [[2025, 40]], CN: [[2025, 9]] }, ['GI', 'CN']);
  assert.equal(view.standings.GI, null);
  assert.equal(view.standings.CN?.of, 2);
  assert.deepEqual(view.distribution.map(([cc]) => cc), ['US', 'CN']);
});

test('a series that has ended is not ranked at all and says when it ended', () => {
  const tourism = INDICATORS.find((i) => i.id === 'tourism_receipts')!;
  assert.equal(tourism.endedYear, 2020);
  const view = buildIndicatorView(tourism, { US: [[2020, 84]], FR: [[2020, 20]] }, ['US']);
  assert.equal(view.endedYear, 2020);
  assert.equal(view.standings.US, null);
  assert.equal(view.distribution.length, 0);
});

test('military spending credits SIPRI as its source', () => {
  for (const id of ['military_usd', 'military_gdp']) {
    const d = INDICATORS.find((i) => i.id === id)!;
    assert.match(sourceFor(d).name, /SIPRI/);
  }
});

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
