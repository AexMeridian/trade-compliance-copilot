// The "Today" dashboard builder: year-over-year with a missing month, sentence templates, and sources that are missing. No network. Run: npm run test:unit
import assert from 'node:assert/strict';
import { buildToday, parseCountries, yearChange, type TodayInputs } from '../src/lib/pulse/briefing.js';

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

const empty: TodayInputs = { now: new Date('2026-11-23T12:00:00Z'), feed: null, news: null, summary: null, markets: null, everyday: null, advisories: null, listChanges: null };

test('year change uses the same month a year earlier when it exists', () => {
  const r = yearChange([['2025-09-01', 100], ['2026-09-01', 110]]);
  assert.equal(r?.since, '2025-09-01');
  assert.ok(Math.abs((r?.changePct ?? 0) - 10) < 1e-9);
});

test('year change falls back to the nearest month when the exact one was never published, and says which', () => {
  const r = yearChange([['2025-09-01', 200], ['2025-11-01', 210], ['2026-10-01', 220]]);
  assert.ok(r && (r.since === '2025-09-01' || r.since === '2025-11-01'));
});

test('year change is null when nothing is within 45 days of a year earlier', () => {
  assert.equal(yearChange([['2024-01-01', 100], ['2026-10-01', 120]]), null);
  assert.equal(yearChange([['2026-10-01', 120]]), null);
});

test('country lists parse from JSON strings, arrays and junk', () => {
  assert.deepEqual(parseCountries('["LY","US"]'), ['LY', 'US']);
  assert.deepEqual(parseCountries(['CN', 'x']), ['CN']);
  assert.deepEqual(parseCountries(''), []);
  assert.deepEqual(parseCountries('not json'), []);
});

test('with no data at all there are no cards and no sentences', () => {
  const t = buildToday(empty);
  assert.equal(t.sentences.length, 0);
  assert.equal(t.trade, null);
  assert.equal(t.prices, null);
  assert.equal(t.money, null);
  assert.equal(t.travel, null);
});

test('sentences are filled from real numbers and drop out with their source', () => {
  const t = buildToday({
    ...empty,
    feed: { actions: [{ title: 'A notice', html_url: 'u', publication_date: '2026-11-20', tag: 'Tariff', countries: '' }, { title: 'Old', html_url: 'u2', publication_date: '2026-10-01', tag: 'Tariff', countries: '' }] },
    summary: { last30: 210, prior30: 204, trendPct: 3 },
    markets: { tiles: [{ id: 'IMF:POILBRE', label: 'Brent', value: 108.41, asOf: '2026-10-01', changePct: 6.2 }], currencies: [{ quote: 'EUR', label: 'EUR per $', rate: 0.91, change30dPct: -2.2, asOf: '2026-11-22' }] },
    listChanges: { generatedAt: '2026-11-23T00:00:00Z', days: [{ date: '2026-11-22', addedTotal: 0, removedTotal: 0, lists: [] }, { date: '2026-11-20', addedTotal: 3, removedTotal: 1, lists: [] }] },
    advisories: { asOf: '2026-11-22T00:00:00Z', source: 's', items: [{ country: 'X', level: 4, title: 't', url: 'u', updated: '2026-11-01' }, { country: 'Y', level: 3, title: 't', url: 'u', updated: '2026-11-02' }] },
  });
  const text = t.sentences.map((s) => s.text).join(' | ');
  assert.match(text, /1 new trade notice in the last 7 days \(210 in the last 30 days\)/);
  assert.match(text, /dollar is down 2\.2% against the euro/);
  assert.match(text, /Oil \(Brent\) is about \$108 a barrel, up 6\.2%/);
  assert.match(text, /1 country currently carries/);
  assert.match(text, /sanctions lists was on 2026-11-20: 3 added, 1 removed/);
  assert.equal(t.money?.data.currencies[0].name, 'Euro');
  assert.ok(!/Gasoline/.test(text), 'no price data, no price sentence');
  assert.equal(t.travel?.data.level3Count, 1);
});

test('a price sentence names the month it compares with', () => {
  const t = buildToday({
    ...empty,
    everyday: { prices: [{ id: 'BLS:CPI_GASOLINE', label: 'Gasoline', latest: ['2026-10-01', 150], points: [['2025-09-01', 100], ['2026-10-01', 150]] }] },
  });
  assert.match(t.sentences[0].text, /Gasoline prices are 50\.0% higher than in Sep 2025/);
});

if (failures) {
  console.error(`${failures} test(s) failed`);
  process.exit(1);
}
console.log('All today tests passed');
