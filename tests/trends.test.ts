// Integrity tests for the trend data behind the Soft Power scoreboard. The Pew trends were parsed from Pew's topline PDFs, the confidence
// pairs were typed from a different Pew page, and the earlier Spring 2025 and 2026 readings were typed from Pew's report charts, so the
// three can be checked against one another: a misparsed row or a mistyped figure would break the match. No network, no database.
// Run: npm run test:unit

import assert from 'node:assert/strict';
import { PEW_CN_FAVORABLE, PEW_US_FAVORABLE } from '../src/lib/power/pewTrends.generated.js';
import { PEW_DRIVERS } from '../src/lib/power/pewDrivers.js';
import { OPINION_SURVEYS } from '../src/lib/power/opinion.js';
import { TREND_READINGS } from '../src/lib/power/trends.js';
import { POWER_EVENTS } from '../src/lib/power/events.js';

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

const at = (series: [number, number][] | undefined, year: number) => series?.find((p) => p[0] === year)?.[1];

test('Pew trends: values are percents, years ascend, one value per year', () => {
  for (const [name, data] of [['US', PEW_US_FAVORABLE], ['CN', PEW_CN_FAVORABLE]] as const) {
    for (const [cc, s] of Object.entries(data)) {
      assert.match(cc, /^[A-Z]{2}$/, `${name} ${cc}`);
      for (let i = 0; i < s.length; i++) {
        assert.ok(s[i][1] >= 0 && s[i][1] <= 100, `${name} ${cc} ${s[i][0]}`);
        if (i > 0) assert.ok(s[i][0] > s[i - 1][0], `${name} ${cc} years ascend`);
      }
    }
  }
});

test('Pew trends match the Spring 2025 and 2026 readings entered from the reports, country by country', () => {
  let checked = 0;
  for (const s of OPINION_SURVEYS) {
    const data = s.subject === 'US' ? PEW_US_FAVORABLE : PEW_CN_FAVORABLE;
    for (const [cc, v] of Object.entries(s.favorable)) {
      const t = at(data[cc], s.year);
      if (t === undefined) continue; // the topline may not carry every country the report charts
      assert.equal(t, v, `${s.id} ${cc}: report ${v}, topline ${t}`);
      checked++;
    }
  }
  assert.ok(checked > 40, `only ${checked} values were comparable`);
});

test('Pew trends match the favorable-view column of the confidence-in-the-president chart page for 2024, 2025 and 2026', () => {
  const years = [2024, 2025, 2026];
  for (const [cc, d] of Object.entries(PEW_DRIVERS)) {
    years.forEach((y, i) => assert.equal(at(PEW_US_FAVORABLE[cc], y), d.favorable[i], `${cc} ${y}`));
  }
});

test('Pew trends: well-known figures', () => {
  assert.equal(at(PEW_US_FAVORABLE.CA, 2025), 34); // Canada fell 20 points between 2024 and 2025
  assert.equal(at(PEW_US_FAVORABLE.CA, 2024), 54);
  assert.equal(at(PEW_US_FAVORABLE.IL, 2025), 83);
  assert.equal(at(PEW_US_FAVORABLE.DE, 2002), 61);
  assert.equal(at(PEW_CN_FAVORABLE.US, 2026), 27); // Americans' own view of China
});

test('Trend readings: years ascend, values in range, every reading is sourced', () => {
  for (const r of TREND_READINGS) {
    assert.match(r.url, /^https:\/\//, r.id);
    assert.ok(r.publisher && r.release && r.caveat && r.headline, r.id);
    for (const l of r.lines) {
      for (let i = 0; i < l.points.length; i++) {
        const [y, v] = l.points[i];
        assert.ok(y >= 2000 && y <= 2030, `${r.id} ${l.subject} year`);
        if (r.unit === 'percent') assert.ok(v >= 0 && v <= 100, `${r.id} ${l.subject} ${y}`);
        if (r.unit === 'net') assert.ok(v >= -100 && v <= 100, `${r.id} ${l.subject} ${y}`);
        if (i > 0) assert.ok(y > l.points[i - 1][0], `${r.id} ${l.subject} years ascend`);
      }
    }
  }
});

test('Trend readings: figures the publishers state in text', () => {
  const v = (id: string, subject: string, year: number) => at(TREND_READINGS.find((r) => r.id === id)!.lines.find((l) => l.subject === subject)!.points, year);
  assert.equal(v('gallup-leadership', 'US', 2025), 31);
  assert.equal(v('gallup-leadership', 'CN', 2025), 36);
  assert.equal(v('gallup-leadership', 'US', 2024), 39);
  assert.equal(v('gallup-leadership', 'DE', 2025), 48);
  assert.equal(v('gallup-migration', 'US', 2008), 24);
  assert.equal(v('gallup-migration', 'US', 2025), 15);
  assert.equal(v('dpi', 'US', 2024), 22);
  assert.equal(v('dpi', 'US', 2025), -5);
  assert.equal(v('dpi', 'CN', 2025), 14);
  assert.equal(v('dpi', 'RU', 2025), -9);
  assert.equal(v('brand-finance', 'US', 2026), 74.9);
  assert.equal(v('brand-finance', 'CN', 2026), 73.5);
});

test('ISEAS: the two sides of each forced choice sum to 100', () => {
  const r = TREND_READINGS.find((x) => x.id === 'iseas-align')!;
  const us = r.lines.find((l) => l.subject === 'US')!.points;
  const cn = r.lines.find((l) => l.subject === 'CN')!.points;
  for (const [y, v] of us) assert.ok(Math.abs(v + (at(cn, y) as number) - 100) < 0.11, String(y));
});

test('Brand Finance stays switched off until the publisher gives permission', () => {
  assert.equal(TREND_READINGS.find((r) => r.id === 'brand-finance')!.enabled, false);
});

test('Events: dated, ascending, each with an https source', () => {
  for (let i = 0; i < POWER_EVENTS.length; i++) {
    const e = POWER_EVENTS[i];
    assert.match(e.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(e.url, /^https:\/\//);
    if (i > 0) assert.ok(e.date >= POWER_EVENTS[i - 1].date, 'events ascend');
  }
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
