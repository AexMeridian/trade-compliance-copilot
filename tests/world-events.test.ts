// USGS and EONET parsers for the Today page's "major world events" card, from small saved shapes. No network. Run: npm run test:unit
import assert from 'node:assert/strict';
import { parseEonet, parseUsgs } from '../src/lib/pulse/worldEvents.js';

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

test('earthquakes: only magnitude 5.5 and up, strongest first, with a plain title', () => {
  const j = { features: [
    { properties: { mag: 4.9, place: 'A', time: Date.parse('2026-11-20T00:00:00Z'), url: 'u1' } },
    { properties: { mag: 6.1, place: '10 km S of Somewhere, Japan', time: Date.parse('2026-11-21T00:00:00Z'), url: 'u2' } },
    { properties: { mag: 5.6, place: 'B', time: Date.parse('2026-11-22T00:00:00Z'), url: 'u3' } },
    { properties: { mag: 7, place: 'no url', time: 1 } },
  ] };
  const r = parseUsgs(j);
  assert.deepEqual(r.map((e) => e.url), ['u2', 'u3']);
  assert.equal(r[0].title, 'Magnitude 6.1 earthquake, 10 km S of Somewhere, Japan');
  assert.equal(r[0].date, '2026-11-21');
});

test('natural events: keeps storms, volcanoes, wildfires and floods; drops icebergs; newest first', () => {
  const j = { events: [
    { title: 'Iceberg A76C', link: 'i', categories: [{ id: 'seaLakeIce' }], geometry: [{ date: '2026-11-22T00:00:00Z' }] },
    { title: 'Tropical Storm X', link: 's', categories: [{ id: 'severeStorms' }], geometry: [{ date: '2026-11-18T06:00:00Z' }, { date: '2026-11-21T06:00:00Z' }] },
    { title: 'Volcano Y', link: 'v', categories: [{ id: 'volcanoes' }], geometry: [{ date: '2026-11-22T00:00:00Z' }] },
    { title: 'No dates', link: 'n', categories: [{ id: 'wildfires' }], geometry: [] },
  ] };
  const r = parseEonet(j);
  assert.deepEqual(r.map((e) => [e.kind, e.title, e.date]), [['volcano', 'Volcano Y', '2026-11-22'], ['storm', 'Tropical Storm X', '2026-11-21']]);
});

test('bad input gives an empty list, not an error', () => {
  assert.deepEqual(parseUsgs(null), []);
  assert.deepEqual(parseEonet({}), []);
});

if (failures) {
  console.error(`${failures} test(s) failed`);
  process.exit(1);
}
console.log('All world-event tests passed');
