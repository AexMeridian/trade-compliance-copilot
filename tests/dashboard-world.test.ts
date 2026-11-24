// The Dashboard's people, politics and world builder: upcoming dates, headlines by topic, travel levels, refugees and aid. No network. Run: npm run test:unit
import assert from 'node:assert/strict';
import { buildWorld, type WorldInputs } from '../src/lib/pulse/dashboardWorld.js';

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
const base: WorldInputs = { now: new Date('2026-11-23T12:00:00Z'), feed: null, news: null, advisories: null, power: null };

test('with no data every panel is empty', () => {
  const w = buildWorld(base);
  assert.deepEqual(w.upcoming, []);
  assert.deepEqual(w.headlines, []);
  assert.equal(w.travel, null);
  assert.equal(w.displacement, null);
  assert.equal(w.humanitarian, null);
});

test('upcoming dates: only the next 60 days, soonest first, with both kinds', () => {
  const w = buildWorld({ ...base, feed: { actions: [
    { title: 'A', html_url: 'a', publication_date: '2026-11-01', comments_close_on: '2026-12-10', effective_on: null },
    { title: 'B', html_url: 'b', publication_date: '2026-11-01', comments_close_on: '2026-11-01', effective_on: '2026-11-30' },
    { title: 'C', html_url: 'c', publication_date: '2026-11-01', comments_close_on: '2027-06-01', effective_on: null },
  ] } });
  assert.deepEqual(w.upcoming.map((u) => [u.date, u.kind, u.title]), [['2026-11-30', 'Takes effect', 'B'], ['2026-12-10', 'Comments close', 'A']]);
});

test('headlines are grouped by topic in plain words, newest first, four at most', () => {
  const items = Array.from({ length: 6 }, (_, k) => ({ title: `T${k}`, url: `u${k}`, source: 's', category: 'Elections & Politics', published_at: `2026-11-1${k}T00:00:00Z`, countries: '["FR"]' }));
  const w = buildWorld({ ...base, news: { items: [...items, { title: 'M', url: 'm', source: 's', category: 'Markets & Currency', published_at: '2026-11-20T00:00:00Z' }] } });
  assert.deepEqual(w.headlines.map((h) => h.topic), ['Elections and politics', 'Money and markets']);
  assert.equal(w.headlines[0].items.length, 4);
  assert.equal(w.headlines[0].items[0].title, 'T5');
  assert.deepEqual(w.headlines[0].items[0].countries, ['FR']);
});

test('travel warnings are counted by level and the Level 4 list is newest first', () => {
  const w = buildWorld({ ...base, advisories: { asOf: '2026-11-22T00:00:00Z', items: [
    { country: 'IR', level: 4, title: 't', url: 'u', updated: '2026-10-01' },
    { country: 'SY', level: 4, title: 't', url: 'u', updated: '2026-10-22' },
    { country: 'FR', level: 2, title: 't', url: 'u', updated: '2026-09-01' },
  ] } });
  assert.deepEqual(w.travel?.counts, [{ level: 1, countries: 0 }, { level: 2, countries: 1 }, { level: 3, countries: 0 }, { level: 4, countries: 2 }]);
  assert.deepEqual(w.travel?.level4.map((a) => a.country), ['SY', 'IR']);
});

test('refugees and humanitarian money: totals and the top ten', () => {
  const dist = Array.from({ length: 12 }, (_, k) => [`C${k}`, (k + 1) * 100] as [string, number]);
  const w = buildWorld({ ...base, power: { indicators: [{ id: 'refugees_hosted', latestYear: 2026, distribution: dist }, { id: 'humanitarian_given', latestYear: 2025, distribution: [['US', 5], ['DE', 3]] }] } });
  assert.equal(w.displacement?.total, 7800);
  assert.equal(w.displacement?.top.length, 10);
  assert.equal(w.displacement?.top[0].cc, 'C11');
  assert.deepEqual(w.humanitarian?.top, [{ cc: 'US', usd: 5 }, { cc: 'DE', usd: 3 }]);
});

if (failures) {
  console.error(`${failures} test(s) failed`);
  process.exit(1);
}
console.log('All dashboard world tests passed');
