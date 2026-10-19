// Integrity tests for the bundled opinion readings and the correlation helper. The readings were extracted from Pew's report
// charts, so these tests re-derive each report's published median from the stored values: a mistyped or misaligned figure
// would move the median. No network, no database. Run: npm run test:unit

import assert from 'node:assert/strict';
import { citationFor, OPINION_SURVEYS } from '../src/lib/power/opinion.js';
import { AFRO_MEDIAN_POSITIVE, AFRO_ROUND10 } from '../src/lib/power/afrobarometer.generated.js';
import { alignmentBand, positionBetween, ranks, spearman } from '../frontend/src/lib/powerStats.js';

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

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

test('there are four Pew readings: the U.S. and China, in 2025 and 2026', () => {
  assert.deepEqual(OPINION_SURVEYS.map((s) => `${s.subject}${s.year}`).sort(), ['CN2025', 'CN2026', 'US2025', 'US2026']);
  assert.equal(new Set(OPINION_SURVEYS.map((s) => s.id)).size, 4);
});

test('every reading names its report, dates and page, and holds valid codes and percentages', () => {
  for (const s of OPINION_SURVEYS) {
    assert.ok(s.title && s.fieldwork && /^\d{4}-\d{2}-\d{2}$/.test(s.release), `${s.id} is missing metadata`);
    assert.ok(s.url.startsWith('https://www.pewresearch.org/'), `${s.id} must link to Pew`);
    assert.ok(Object.keys(s.favorable).length >= 20, `${s.id} has too few countries`);
    for (const [cc, v] of Object.entries(s.favorable)) {
      assert.match(cc, /^[A-Z]{2}$/, `${s.id}: bad code ${cc}`);
      assert.ok(Number.isInteger(v) && v >= 0 && v <= 100, `${s.id}: ${cc} = ${v}`);
    }
  }
});

test('the number of countries matches what Pew says its median covers', () => {
  for (const s of OPINION_SURVEYS) assert.equal(Object.keys(s.favorable).length, s.countriesInMedian, s.id);
});

test("each stored set reproduces the median Pew published (a misread chart value would move it)", () => {
  for (const s of OPINION_SURVEYS) {
    const m = median(Object.values(s.favorable));
    assert.ok(Math.abs(m - s.publishedMedian) <= 0.5, `${s.id}: computed ${m}, Pew published ${s.publishedMedian}`);
  }
});

test('a few figures the reports state in their own text', () => {
  const by = Object.fromEntries(OPINION_SURVEYS.map((s) => [s.id, s.favorable]));
  assert.equal(by['pew-2025-cn'].MX, 56); // "56% of adults view China positively" in Mexico
  assert.equal(by['pew-2025-us'].MX, 29); // "29% say the same of the U.S."
  assert.equal(by['pew-2025-us'].IL, 83); // 83% view the U.S. favorably in Israel
  assert.equal(by['pew-2025-cn'].IL, 33);
  assert.equal(by['pew-2025-cn'].JP, 13); // "only 13% ... in Japan"
  assert.equal(by['pew-2025-us'].CA, 34); // Canada: 34% U.S. and 34% China
  assert.equal(by['pew-2025-cn'].CA, 34);
  assert.equal(by['pew-2026-us'].IL, 81); // highest U.S. rating, Israel
  assert.equal(by['pew-2026-us'].SE, 19); // lowest in Europe, Sweden
  assert.equal(by['pew-2026-us'].MX, 40); // Mexico, 29% -> 40%
  assert.equal(by['pew-2026-cn'].US, 27); // 27% of Americans view China favorably
  assert.equal(by['pew-2026-cn'].JP, 11);
  assert.equal(by['pew-2026-cn'].PK, 90); // "Nine-in-ten Pakistanis"
});

test('citations follow Pew’s requested format', () => {
  const c = citationFor(OPINION_SURVEYS[0]);
  assert.ok(c.includes('Pew Research Center, Washington, D.C.') && c.includes(OPINION_SURVEYS[0].url));
});

test('ranks share the average for ties', () => {
  assert.deepEqual(ranks([10, 20, 20, 30]), [1, 2.5, 2.5, 4]);
});

test('spearman: perfect, inverse, none, and too-little data', () => {
  assert.equal(spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1);
  assert.equal(spearman([1, 2, 3, 4], [40, 30, 20, 10]), -1);
  assert.equal(spearman([1, 2, 3], [5, 5, 5]), null);
  assert.equal(spearman([1, 2], [1, 2]), null);
  const r = spearman([1, 2, 3, 4, 5], [2, 1, 4, 3, 5]);
  assert.ok(r !== null && r > 0.7 && r < 1);
  assert.equal(spearman([1, 10, 100, 1000], [1, 2, 3, 4]), 1); // monotonic but not linear: still perfect
});

test('placement between China (0) and the United States (1) is linear and not clipped', () => {
  assert.equal(positionBetween(-0.4, -0.4, 2.9), 0);
  assert.equal(positionBetween(2.9, -0.4, 2.9), 1);
  assert.ok(Math.abs(positionBetween(1.25, -0.4, 2.9) - 0.5) < 1e-9);
  assert.ok(positionBetween(3.5, -0.4, 2.9) > 1);
  assert.equal(positionBetween(1, 2, 2), 0.5); // the two powers at the same spot: no division by zero
});

test('alignment bands: five groups with the edges falling where the labels say', () => {
  assert.equal(alignmentBand(-0.3), 'china');
  assert.equal(alignmentBand(0.19), 'china');
  assert.equal(alignmentBand(0.2), 'leanChina');
  assert.equal(alignmentBand(0.5), 'middle');
  assert.equal(alignmentBand(0.6), 'middle');
  assert.equal(alignmentBand(0.61), 'leanUs');
  assert.equal(alignmentBand(0.8), 'leanUs');
  assert.equal(alignmentBand(1.4), 'us');
});

test('Afrobarometer shares are valid, dated, and reproduce the stored medians; China matches the published 62%', () => {
  const rows = Object.entries(AFRO_ROUND10);
  assert.equal(rows.length, 38);
  for (const [cc, r] of rows) {
    assert.match(cc, /^[A-Z]{2}$/);
    assert.match(r.from, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(r.to >= r.from, cc);
    for (const k of ['cn', 'us'] as const) {
      assert.ok(r[k].pos >= 0 && r[k].neg >= 0 && r[k].pos + r[k].neg <= 101, `${cc} ${k}`);
      assert.ok(r[k].n >= 800, `${cc} ${k} has too few interviews`);
    }
  }
  assert.ok(Math.abs(median(rows.map(([, r]) => r.cn.pos)) - AFRO_MEDIAN_POSITIVE.cn) <= 0.5);
  assert.ok(Math.abs(median(rows.map(([, r]) => r.us.pos)) - AFRO_MEDIAN_POSITIVE.us) <= 0.5);
  assert.equal(AFRO_MEDIAN_POSITIVE.cn, 62); // Afrobarometer's 2026 African Insights report: 62% across 38 countries
});

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
