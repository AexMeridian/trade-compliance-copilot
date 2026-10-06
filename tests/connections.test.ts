// Deterministic tests for the topic rules and the cross-domain link engine --
// no network, no database. Run: npm run test:unit
import assert from 'node:assert/strict';
import { topicsFor, topicHintForActionTag } from '../src/lib/pulse/topic.js';
import { extractCountries } from '../src/lib/pulse/country.js';
import { relate, findRelated, marketReaction, daysBetween, type ConnEvent } from '../src/lib/pulse/links.js';

let failures = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`PASS  ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL  ${name}\n      ${(e as Error).message}`);
  }
}

// --- topics ---------------------------------------------------------------
test('a sanctions-on-oil headline gets both Sanctions and Energy', () => {
  const t = topicsFor('US imposes new sanctions on Russian oil exporters');
  assert.ok(t.includes('Sanctions') && t.includes('Energy'));
});
test('steel tariff headline: Tariffs + Metals, not Agriculture', () => {
  const t = topicsFor('Section 232 tariffs on steel and aluminum imports raised to 50%');
  assert.ok(t.includes('Tariffs') && t.includes('Metals & minerals'));
  assert.equal(t.includes('Agriculture'), false);
});
test('trade-dispute language counts as Tariffs', () => {
  assert.ok(topicsFor('Merz, Macron seek tougher EU measures against unfair trade').includes('Tariffs'));
});
test('an unrelated headline gets no topics (never forced into one)', () => {
  assert.deepEqual(topicsFor('Would you chase a friend for five pounds?'), []);
});
test('hints add certain topics without removing detected ones', () => {
  const t = topicsFor('Amendments to regulations', topicHintForActionTag('Sanctions'));
  assert.deepEqual(t, ['Sanctions']);
});
test('"Al Jazeera" is not read as the AI topic', () => {
  assert.equal(topicsFor('Al Jazeera reports on local festival').includes('Technology'), false);
});

// --- country extraction for sanctions text --------------------------------
test('Hong Kong is recognized', () => assert.deepEqual(extractCountries('Kowloon, Hong Kong'), ['HK']));
test("North Korea's inverted official name maps to KP only", () => {
  assert.deepEqual(extractCountries("Korea, Democratic People's Republic of"), ['KP']);
});
test("the long North Korea name no longer also tags South Korea", () => {
  assert.deepEqual(extractCountries("Democratic People's Republic of Korea"), ['KP']);
});
test('South Korea is still recognized', () => assert.deepEqual(extractCountries('Republic of Korea'), ['KR']));

// --- linking --------------------------------------------------------------
const ev = (over: Partial<ConnEvent>): ConnEvent => ({
  kind: 'news', id: 'n1', date: '2026-09-10', title: 't', url: null, source: null, countries: ['CN'], topics: ['Tariffs'], ...over,
});
const subject = ev({ kind: 'action', id: 'a1' });

test('same country + shared topic + inside window -> linked, with a reason', () => {
  const l = relate(subject, ev({ date: '2026-09-13' }), 7, (c) => (c === 'CN' ? 'China' : c));
  assert.ok(l);
  assert.equal(l.daysApart, 3);
  assert.match(l.reason, /Both name China, both about tariffs, 3 days apart\./);
});
test('different country -> not linked', () => assert.equal(relate(subject, ev({ countries: ['VN'] }), 7), null));
test('no shared topic -> not linked', () => assert.equal(relate(subject, ev({ topics: ['Agriculture'] }), 7), null));
test('outside the window -> not linked', () => assert.equal(relate(subject, ev({ date: '2026-09-25' }), 7), null));
test('an event is never linked to itself', () => assert.equal(relate(subject, { ...subject }, 7), null));
test('same-day events say so', () => {
  const l = relate(subject, ev({ date: '2026-09-10' }), 7);
  assert.match(l!.reason, /the same day/);
});
test('more shared topics rank higher than closer-in-time', () => {
  const two = ev({ id: 'far', date: '2026-09-16', topics: ['Tariffs', 'Metals & minerals'] });
  const one = ev({ id: 'near', date: '2026-09-10', topics: ['Tariffs'] });
  const s = ev({ kind: 'action', id: 'a', topics: ['Tariffs', 'Metals & minerals'] });
  const out = findRelated(s, [one, two], { windowDays: 7, limit: 5 });
  assert.deepEqual(out.map((l) => l.event.id), ['far', 'near']);
});
test('limit is respected', () => {
  const many = Array.from({ length: 10 }, (_, i) => ev({ id: `n${i}` }));
  assert.equal(findRelated(subject, many, { windowDays: 7, limit: 3 }).length, 3);
});
test('a roundup naming more than 3 countries links to nothing', () => {
  assert.equal(relate(ev({ countries: ['CN', 'TR', 'IR', 'YE'] }), ev({}), 7), null);
  assert.equal(relate(ev({}), ev({ countries: ['CN', 'TR', 'IR', 'YE'] }), 7), null);
});
test('two routine actions sharing only "Tariffs" are not linked', () => {
  assert.equal(relate(subject, ev({ kind: 'action', id: 'a2' }), 7), null);
});
test('two actions sharing a specific topic beyond Tariffs are linked', () => {
  const a = ev({ kind: 'action', id: 'a1', topics: ['Tariffs', 'Metals & minerals'] });
  const b = ev({ kind: 'action', id: 'a2', topics: ['Tariffs', 'Metals & minerals'] });
  assert.ok(relate(a, b, 7));
});
test('cross-domain links outrank same-kind ones', () => {
  const s = ev({ kind: 'news', id: 's', topics: ['Elections & politics'] });
  const sameKind = ev({ kind: 'news', id: 'x', date: '2026-09-10', topics: ['Elections & politics'] });
  const crossKind = ev({ kind: 'gta', id: 'y', date: '2026-09-17', topics: ['Elections & politics'] });
  const out = findRelated(s, [sameKind, crossKind], { windowDays: 10, limit: 5 });
  assert.equal(out[0].event.id, 'y');
});
test('diplomacy has its own topic; a bare "president" does not trigger politics', () => {
  assert.ok(topicsFor('Trump and Xi hold summit as ambassadors meet').includes('Diplomacy & alliances'));
  assert.equal(topicsFor('The president said on Monday that he was pleased').includes('Elections & politics'), false);
});
test('daysBetween handles month boundaries', () => assert.equal(daysBetween('2026-08-30', '2026-09-02'), 3));

// --- market reaction --------------------------------------------------------
const series = [
  { obs_date: '2026-09-08', value: 100 },
  { obs_date: '2026-09-09', value: 100 },
  { obs_date: '2026-09-10', value: 100 },
  { obs_date: '2026-09-15', value: 102 },
  { obs_date: '2026-09-16', value: 103 },
];
test('reaction: last obs on/before the date vs first obs on/after +5 days', () => {
  const r = marketReaction(series, '2026-09-10');
  assert.ok(r);
  assert.equal(r.beforeDate, '2026-09-10');
  assert.equal(r.afterDate, '2026-09-15');
  assert.equal(r.changePct, 2);
});
test('reaction uses a prior obs when the event falls on a weekend', () => {
  const r = marketReaction(series, '2026-09-11'); // no 09-11 obs; 09-10 is one day earlier
  assert.equal(r?.beforeDate, '2026-09-10');
});
test('reaction is null when there is no "after" data yet (recent event)', () => {
  assert.equal(marketReaction(series, '2026-09-16'), null);
});
test('reaction is null when the series starts after the event', () => {
  assert.equal(marketReaction(series, '2026-08-01'), null);
});
test('reaction is null rather than dividing by zero', () => {
  assert.equal(marketReaction([{ obs_date: '2026-09-10', value: 0 }, { obs_date: '2026-09-15', value: 1 }], '2026-09-10'), null);
});

if (failures > 0) {
  console.log(`\n${failures} test(s) failed`);
  process.exit(1);
}
console.log('\nAll connection tests passed');
