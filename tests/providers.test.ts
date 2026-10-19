// Parser and derivation tests for the UN voting, UNESCO student, UNHCR and Nobel feeds. Fixtures are small excerpts shaped
// like the real responses (checked against the live APIs). No network, no database. Run: npm run test:unit

import assert from 'node:assert/strict';
import { parseCountryCodes, codeForName } from '../src/lib/refresh/countryCodes.js';
import { parseIdealPoints, splitCsvLine } from '../src/lib/refresh/unVoting.js';
import { parseUis } from '../src/lib/refresh/uisStudents.js';
import { parseUnhcr } from '../src/lib/refresh/unhcr.js';
import { countNobel } from '../src/lib/refresh/nobel.js';
import { parseFtsYear, seriesFromYears } from '../src/lib/refresh/fts.js';
import { deriveRows, buildPowerView } from '../src/lib/power/compute.js';
import { parseSeriesMulti, planBatches } from '../src/lib/refresh/powerIndicators.js';
import { parseUndp } from '../src/lib/refresh/undp.js';
import { parseGroups, shares, MIN_WORKS } from '../src/lib/refresh/openalex.js';
import { INDICATORS } from '../src/lib/power/indicators.js';

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

const codes = parseCountryCodes([{}, [
  { id: 'USA', iso2Code: 'US', name: 'United States', region: { id: 'NAC' } },
  { id: 'CHN', iso2Code: 'CN', name: 'China', region: { id: 'EAS' } },
  { id: 'RUS', iso2Code: 'RU', name: 'Russian Federation', region: { id: 'ECS' } },
  { id: 'DEU', iso2Code: 'DE', name: 'Germany', region: { id: 'ECS' } },
  { id: 'TUR', iso2Code: 'TR', name: 'Turkiye', region: { id: 'ECS' } },
  { id: 'NLD', iso2Code: 'NL', name: 'Netherlands', region: { id: 'ECS' } },
  { id: 'KOR', iso2Code: 'KR', name: 'Korea, Rep.', region: { id: 'EAS' } },
  { id: 'CIV', iso2Code: 'CI', name: "Cote d'Ivoire", region: { id: 'SSF' } },
  { id: 'GBR', iso2Code: 'GB', name: 'United Kingdom', region: { id: 'ECS' } },
  { id: 'COD', iso2Code: 'CD', name: 'Congo, Dem. Rep.', region: { id: 'SSF' } },
  { id: 'EMU', iso2Code: 'XC', name: 'Euro area', region: { id: 'NA' } },
]]);

test('country codes map three-letter and names, skip aggregates, and accept the aliases other feeds use', () => {
  assert.equal(codes.iso3ToIso2.get('DEU'), 'DE');
  assert.equal(codes.iso3ToIso2.get('EMU'), undefined);
  assert.equal(codeForName(codes, 'USA'), 'US');
  assert.equal(codeForName(codes, 'Russia'), 'RU');
  assert.equal(codeForName(codes, 'the Netherlands'), 'NL');
  assert.equal(codeForName(codes, 'Euro area'), undefined);
  assert.equal(codeForName(codes, 'Scotland'), 'GB');
  assert.equal(codeForName(codes, 'Türkiye'), 'TR'); // accents are ignored
  assert.equal(codeForName(codes, "Côte d'Ivoire"), 'CI');
  assert.equal(codeForName(codes, 'Korea, Republic of'), 'KR');
  assert.equal(codeForName(codes, 'Democratic Republic of the Congo'), 'CD');
});

test('CSV lines keep commas inside quoted fields', () => {
  assert.deepEqual(splitCsvLine('"1",2,"Korea, South","say ""hi"""'), ['1', '2', 'Korea, South', 'say "hi"']);
});

const ideal = [
  '"","ccode","session","NVotesFP","IdealPointFP","iso3c","Countryname","year"',
  '"1",2,80,191,2.891,"USA","United States",2025',
  '"2",710,80,191,-0.369,"CHN","China",2025',
  '"3",365,80,191,0.081,"RUS","Russia",2025',
  '"4",255,80,191,1.2,"DEU","Germany",2025',
  '"5",2,79,190,2.5,"USA","United States",2024',
  '"6",255,79,190,1.1,"DEU","Germany",2024',
  '"7",2,10,50,1.6,"USA","United States",1955',
  '"8",345,80,191,0.5,"YUG","Yugoslavia",2025',
].join('\n');

test('ideal points: keeps 2000 onward, maps codes, drops unmapped states', () => {
  const out = parseIdealPoints(ideal, codes.iso3ToIso2);
  assert.deepEqual(out.US, [[2024, 2.5], [2025, 2.891]]);
  assert.equal(out.DE?.length, 2);
  assert.equal(out.YU, undefined);
  assert.ok(!Object.values(out).flat().some(([y]) => y < 2000));
});

test('ideal points: a changed file shape throws instead of loading nothing', () => {
  assert.throws(() => parseIdealPoints('a,b\n1,2', codes.iso3ToIso2));
});

test('derived UN distances: same-year gap from the reference, never from the reference to itself', () => {
  const stored = parseIdealPoints(ideal, codes.iso3ToIso2);
  const rows = deriveRows(new Map([['un_ideal_point', stored]]));
  assert.deepEqual(rows.get('un_dist_us')?.DE, [[2024, 1.4], [2025, 1.691]]);
  assert.equal(rows.get('un_dist_us')?.US, undefined);
  assert.deepEqual(rows.get('un_dist_cn')?.US, [[2025, 3.26]]); // China has no 2024 row in the fixture, so only 2025 exists
  assert.ok(rows.get('un_dist_ru')?.CN);
});

test('hidden series are stored but not shown; derived ones are shown', () => {
  const ids = buildPowerView(new Map(), []).map((v) => v.id);
  assert.ok(!ids.includes('un_ideal_point'));
  assert.ok(ids.includes('un_dist_us') && ids.includes('refugees_per_1000'));
});

test('UNESCO students: maps codes, groups by series, keeps newest twelve, ignores empty values', () => {
  const records = [
    { indicatorId: '26637', geoUnit: 'USA', year: 2023, value: 956923.4 },
    { indicatorId: '26637', geoUnit: 'USA', year: 2021, value: 833204 },
    { indicatorId: '26637', geoUnit: 'DEU', year: 2023, value: null },
    { indicatorId: 'MENFR.5T8', geoUnit: 'DEU', year: 2023, value: 4.567 },
    { indicatorId: '26637', geoUnit: 'XXX', year: 2023, value: 5 },
    ...Array.from({ length: 15 }, (_, i) => ({ indicatorId: 'MENFR.5T8', geoUnit: 'CHN', year: 2010 + i, value: i })),
  ];
  const out = parseUis({ records }, codes.iso3ToIso2);
  assert.deepEqual(out.get('26637')?.US, [[2021, 833204], [2023, 956923.4]]);
  assert.equal(out.get('26637')?.DE, undefined);
  assert.deepEqual(out.get('MENFR.5T8')?.DE, [[2023, 4.57]]);
  assert.equal(out.get('MENFR.5T8')?.CN.length, 12);
  assert.throws(() => parseUis({ nope: 1 }, codes.iso3ToIso2));
});

test('UNHCR: numbers that arrive as strings are read, repeats in a year are added, unknown codes skipped', () => {
  const items = [
    { year: 2024, coa_iso: 'TUR', refugees: 2940735 },
    { year: 2024, coa_iso: 'DEU', refugees: '1000' },
    { year: 2024, coa_iso: 'DEU', refugees: '500' },
    { year: 2023, coa_iso: 'DEU', refugees: '0' },
    { year: 2024, coa_iso: 'ZZZ', refugees: 5 },
    { year: 2024, coa_iso: 'USA', refugees: '-' },
  ];
  const out = parseUnhcr({ items }, codes.iso3ToIso2);
  assert.deepEqual(out.TR, [[2024, 2940735]]);
  assert.deepEqual(out.DE, [[2023, 0], [2024, 1500]]);
  assert.equal(out.US, undefined);
  assert.throws(() => parseUnhcr({}, codes.iso3ToIso2));
});

test('derived refugees per 1,000: uses same-year or nearest earlier population and leaves out countries without one', () => {
  const rows = deriveRows(new Map([
    ['refugees_hosted', { TR: [[2024, 3_000_000]], DE: [[2024, 1500]], FR: [[2024, 10]] } as never],
    ['population', { TR: [[2023, 85_000_000]], DE: [[2024, 84_000_000]] } as never],
  ]));
  const per = rows.get('refugees_per_1000')!;
  assert.equal(per.TR[0][1], 35.294);
  assert.equal(per.DE[0][1], 0.018);
  assert.equal(per.FR, undefined);
});

test('Nobel: counts persons by birth country and prizes by institution country, once per prize and country', () => {
  const laureates = [
    { birth: { place: { countryNow: { en: 'USA' } } }, nobelPrizes: [{ awardYear: '2001', affiliations: [{ countryNow: { en: 'USA' } }, { countryNow: { en: 'USA' } }] }] },
    { birth: { place: { countryNow: { en: 'Germany' } } }, nobelPrizes: [{ awardYear: '2024', affiliations: [{ countryNow: { en: 'USA' } }, { countryNow: { en: 'Germany' } }] }] },
    { birth: { place: { countryNow: { en: 'Atlantis' } } }, nobelPrizes: [{ awardYear: '1950' }] },
    { nobelPrizes: [{ awardYear: '1960' }] },
  ];
  const r = countNobel(laureates, codes);
  assert.deepEqual(r.born.US, [[2024, 1]]);
  assert.deepEqual(r.born.DE, [[2024, 1]]);
  assert.deepEqual(r.affiliated.US, [[2024, 2]]); // two prizes, one of them with two entries for the same country
  assert.deepEqual(r.affiliated.DE, [[2024, 1]]);
  assert.deepEqual(r.unmapped, ['Atlantis']);
});

test('OCHA funding: reads donor (source) totals only, maps UN names, skips non-countries and non-positive totals', () => {
  const body = { data: { report1: { fundingTotals: { objects: [
    { direction: 'source', singleFundingObjects: [
      { name: 'United States', totalFunding: 4_000_000_000 },
      { name: 'Korea, Republic of', totalFunding: 200_000_000 },
      { name: 'Not specified', totalFunding: 5 },
      { name: 'Germany', totalFunding: 0 },
    ] },
    { direction: 'destination', singleFundingObjects: [{ name: 'Germany', totalFunding: 9 }] },
  ] } } } };
  const { totals, unmapped } = parseFtsYear(body, codes);
  assert.equal(totals.get('US'), 4_000_000_000);
  assert.equal(totals.get('KR'), 200_000_000);
  assert.equal(totals.has('DE'), false);
  assert.deepEqual(unmapped, ['Not specified']);
  assert.throws(() => parseFtsYear({}, codes));
  assert.deepEqual(seriesFromYears(new Map([[2024, new Map([['US', 5]])], [2023, new Map([['US', 3.4]])]])), { US: [[2023, 3], [2024, 5]] });
});

test('derived humanitarian funding per resident divides by population for the same or nearest earlier year', () => {
  const rows = deriveRows(new Map([
    ['humanitarian_given', { SE: [[2024, 1_000_000_000]], XX: [[2024, 5]] } as never],
    ['population', { SE: [[2023, 10_000_000]] } as never],
  ]));
  assert.equal(rows.get('humanitarian_per_person')?.SE[0][1], 100);
  assert.equal(rows.get('humanitarian_per_person')?.XX, undefined);
});

test('every shown series names its source, and derived series credit their inputs', () => {
  for (const v of buildPowerView(new Map(), [])) {
    assert.ok(v.source.name && v.source.url.startsWith('https://'), v.id);
  }
  const by = Object.fromEntries(buildPowerView(new Map(), []).map((v) => [v.id, v.source.name]));
  assert.match(by.students_inbound, /UNESCO/);
  assert.match(by.refugees_hosted, /UNHCR/);
  assert.match(by.refugees_per_1000, /World Bank/);
  assert.match(by.nobel_born, /Nobel/);
  assert.match(by.humanitarian_given, /OCHA/);
  assert.match(by.humanitarian_per_person, /World Bank/);
  assert.match(by.un_dist_cn, /Voeten/);
  assert.match(by.wgi_voice, /Governance/);
  assert.match(by.gdp_usd, /Development Indicators/);
});

test('every provider has at least one series, and every non-derived series is unique by id', () => {
  const providers = new Set(INDICATORS.map((i) => i.provider));
  for (const p of ['worldbank', 'voeten', 'uis', 'unhcr', 'nobel', 'fts', 'derived']) assert.ok(providers.has(p as never), p);
  assert.equal(new Set(INDICATORS.map((i) => i.id)).size, INDICATORS.length);
  for (const d of INDICATORS.filter((i) => i.reference)) assert.ok(['US', 'CN', 'RU'].includes(d.reference!));
});

test('World Bank series are grouped by database, six at a time, so a page never overflows', () => {
  const defs = INDICATORS.filter((d) => d.provider === 'worldbank');
  const batches = planBatches(defs);
  assert.equal(batches.flat().length, defs.length, 'every series is in exactly one request');
  for (const b of batches) {
    assert.ok(b.length >= 1 && b.length <= 6);
    assert.equal(new Set(b.map((d) => d.wbSource)).size, 1, 'one database per request');
  }
  assert.ok(batches.length <= 7, `${batches.length} requests`);
});

test('a multi-indicator World Bank response is split by indicator, real countries only', () => {
  const countries = new Set(['US', 'CN']);
  const row = (id: string, cc: string, date: string, value: number | null) => ({ indicator: { id }, country: { id: cc }, date, value });
  const body = [{ pages: 1 }, [row('A', 'US', '2023', 1), row('A', 'CN', '2023', 2), row('B', 'US', '2022', 5), row('B', 'US', '2023', null), row('B', '1W', '2023', 9), row('A', 'US', '2024', 3)]];
  const out = parseSeriesMulti(body, countries);
  assert.deepEqual(out.get('A')?.US, [[2023, 1], [2024, 3]]);
  assert.deepEqual(out.get('A')?.CN, [[2023, 2]]);
  assert.deepEqual(out.get('B')?.US, [[2022, 5]]);
  assert.equal(out.get('B')?.['1W'], undefined, 'aggregates are dropped');
  assert.throws(() => parseSeriesMulti([{ message: [{ value: 'The indicator was not found.' }] }], countries), /not found/);
  assert.throws(() => parseSeriesMulti([{ pages: 2 }, []], countries), /more than one page/);
});

test('UNDP wide CSV: one series per measure, countries only, blanks and the ".." marker skipped', () => {
  const csv = [
    'iso3,country,hdicode,hdi_2022,hdi_2023,gii_2023,mys_2023',
    'USA,United States,Very High,0.931,0.938,0.169,13.9',
    'NGA,Nigeria,Low,..,0.56,0.677,7.586',
    'ZZA.VHHD,Very high human development,,0.9,0.91,,',
    'XXX,Unknown place,,0.5,0.5,0.5,5',
  ].join('\n');
  const out = parseUndp(csv, new Map([['USA', 'US'], ['NGA', 'NG']]));
  assert.deepEqual(out.hdi.US, [[2022, 0.931], [2023, 0.938]]);
  assert.deepEqual(out.hdi.NG, [[2023, 0.56]]);
  assert.deepEqual(out.gii.NG, [[2023, 0.677]]);
  assert.deepEqual(Object.keys(out.hdi).sort(), ['NG', 'US']);
  assert.throws(() => parseUndp('country,x\nA,1', new Map()), /iso3/);
});

test('OpenAlex: shares are works with the partner over a country\'s own total; small and missing countries get no reading', () => {
  const key = (cc: string) => `https://openalex.org/countries/${cc}`;
  const totals = parseGroups({ group_by: [{ key: key('US'), count: 6000 }, { key: key('NG'), count: 2000 }, { key: key('TV'), count: 40 }, { key: key('KE'), count: 1500 }, { key: 'bad', count: 5 }] });
  assert.equal(totals.size, 4);
  const withUs = parseGroups({ group_by: [{ key: key('US'), count: 6000 }, { key: key('NG'), count: 142 }, { key: key('TV'), count: 20 }] });
  const out = shares(totals, withUs, 'US', 2025, new Set(['US', 'NG', 'TV', 'KE']));
  assert.deepEqual(out, { NG: [[2025, 7.1]] }, 'partner skipped; TV below the minimum; KE absent from the breakdown');
  assert.ok(MIN_WORKS >= 500);
  assert.throws(() => parseGroups({}), /shape changed/);
});

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
