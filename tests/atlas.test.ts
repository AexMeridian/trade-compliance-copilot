// The maps' classes and the bundled bilateral and survey data they draw. No network, no database. Run: npm run test:unit

import assert from 'node:assert/strict';
import { divergingBanding, quintileBreaks, sequentialBanding, SEQUENTIAL_RAMP } from '../frontend/src/lib/atlasBands.js';
import { CEPII_PARTNERS, CEPII_TIES } from '../src/lib/power/cepii.generated.js';
import { AFRO_ROUND10 } from '../src/lib/power/afrobarometer.generated.js';

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
const f = (v: number) => `${v}%`;

test('sequential classes split a spread of values into five, dimmest to brightest, each value in exactly one', () => {
  const values = Array.from({ length: 100 }, (_, i) => i + 1);
  const b = sequentialBanding(values, f);
  assert.equal(b.classes.length, 5);
  assert.deepEqual(b.classes.map((c) => c.color), SEQUENTIAL_RAMP);
  const counts = [0, 0, 0, 0, 0];
  for (const v of values) counts[b.classOf(v)]++;
  assert.ok(counts.every((n) => n >= 15 && n <= 25), counts.join(','));
  assert.equal(b.classOf(1), 0);
  assert.equal(b.classOf(100), 4);
});

test('when many values tie there are fewer classes, never a legend entry like "0% to 0%"', () => {
  const values = [0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 5, 9];
  const b = sequentialBanding(values, f);
  assert.ok(b.classes.length >= 2 && b.classes.length <= 5);
  assert.equal(new Set(b.classes.map((c) => c.label)).size, b.classes.length, 'labels are distinct');
  assert.ok(!b.classes.some((c) => /^(\d+)% to (?:under )?\1%$/.test(c.label)));
  for (const v of values) assert.ok(b.classOf(v) >= 0 && b.classOf(v) < b.classes.length);
  assert.equal(sequentialBanding([4, 4, 4], f).classes.length, 1);
});

test('diverging classes are symmetric around "about even" and named for both sides', () => {
  const b = divergingBanding(7, 20, 'favorable to China', 'favorable to the U.S.');
  assert.equal(b.classOf(-30), 0);
  assert.equal(b.classOf(-10), 1);
  assert.equal(b.classOf(0), 2);
  assert.equal(b.classOf(7), 2);
  assert.equal(b.classOf(12), 3);
  assert.equal(b.classOf(25), 4);
  assert.ok(b.classes[0].label.includes('China') && b.classes[4].label.includes('U.S.'));
  assert.deepEqual(quintileBreaks([]), []);
});

test('CEPII ties: valid codes, the seven partners, and facts that are well known', () => {
  assert.deepEqual([...CEPII_PARTNERS], ['US', 'GB', 'FR', 'ES', 'PT', 'RU', 'CN']);
  const codes = Object.keys(CEPII_TIES);
  assert.ok(codes.length >= 180, `${codes.length} countries`);
  for (const [cc, t] of Object.entries(CEPII_TIES)) {
    assert.match(cc, /^[A-Z]{2}$/);
    for (const p of [...t.lang, ...t.colony]) assert.ok((CEPII_PARTNERS as readonly string[]).includes(p), `${cc}: ${p}`);
  }
  assert.ok(CEPII_TIES.BR.lang.includes('PT') && CEPII_TIES.MX.lang.includes('ES') && CEPII_TIES.SN.lang.includes('FR'));
  assert.ok(CEPII_TIES.IN.lang.includes('GB') && CEPII_TIES.NG.colony.includes('GB') && CEPII_TIES.AO.colony.includes('PT'));
  assert.deepEqual(CEPII_TIES.CN, { lang: [], colony: [] });
});

test('Afrobarometer extra items: shares are valid and the base is large enough everywhere they appear', () => {
  const rows = Object.entries(AFRO_ROUND10);
  let withRu = 0;
  let withCovid = 0;
  let withUkraine = 0;
  for (const [cc, r] of rows) {
    for (const k of ['ru', 'in', 'fc', 'eu'] as const) {
      const s = r[k];
      if (!s) continue;
      if (k === 'ru') withRu++;
      assert.ok(s.pos >= 0 && s.neg >= 0 && s.pos + s.neg <= 101 && s.n >= 300, `${cc} ${k}`);
    }
    if (r.covid) {
      withCovid++;
      const total = r.covid.china + r.covid.us + r.covid.russia + r.covid.europe + r.covid.india + r.covid.au + r.covid.none;
      assert.ok(total <= 102 && r.covid.n >= 300, `${cc} covid ${total}`);
    }
    if (r.ukraine) {
      withUkraine++;
      assert.ok(r.ukraine.neutral + r.ukraine.russia + r.ukraine.ukraine <= 101 && r.ukraine.n >= 300, `${cc} ukraine`);
    }
  }
  assert.ok(withRu >= 30 && withCovid >= 30 && withUkraine >= 30, `${withRu}/${withCovid}/${withUkraine}`);
});

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
