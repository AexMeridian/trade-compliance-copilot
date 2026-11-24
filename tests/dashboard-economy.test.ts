// The Dashboard's markets and economy builder: wording, the missing-October price gap, an inverted rate curve, and sources that are missing. No network. Run: npm run test:unit
import assert from 'node:assert/strict';
import { buildEconomy, type EconomyInputs } from '../src/lib/pulse/dashboardEconomy.js';

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

const base: EconomyInputs = { now: new Date('2026-11-23T12:00:00Z'), markets: null, everyday: null, tic: null };
const tile = (id: string, value: number, extra: object = {}) => ({ id, label: id, unit: 'u', value, asOf: '2026-11-20', changePct: null, ...extra });

test('with no data there are no panels and no key numbers', () => {
  const e = buildEconomy(base);
  assert.equal(e.rates, null);
  assert.equal(e.jobs, null);
  assert.equal(e.keyNumbers.length, 0);
  assert.equal(e.commodities.length, 0);
});

test('an inverted curve is said in plain words and the 10-year rate becomes a key number', () => {
  const e = buildEconomy({ ...base, markets: { tiles: [tile('UST:3M', 5.0), tile('UST:2Y', 4.9), tile('UST:10Y', 4.2), tile('UST:30Y', 4.4)], currencies: [] } });
  assert.equal(e.rates?.inverted, true);
  assert.ok(e.summary.some((s) => /borrowing costs more than long-term|costs more than long-term/.test(s)));
  assert.equal(e.keyNumbers[0].id, 'ten-year');
  assert.equal(e.keyNumbers[0].value, '4.20%');
});

test('prices use the nearest month when the exact one was never published, and the key number says which', () => {
  const e = buildEconomy({ ...base, everyday: { prices: [{ id: 'BLS:CPI', label: 'All', latest: ['2026-10-01', 103], points: [['2025-09-01', 100], ['2026-10-01', 103]] }] } });
  assert.equal(e.inflation?.cpi?.since, '2025-09-01');
  assert.equal(e.keyNumbers[0].value, '+3.0%');
  assert.equal(e.keyNumbers[0].change, 'compared with Sep 2025');
  assert.equal(e.keyNumbers[0].direction, 'up');
});

test('unemployment and payroll change are worded without jargon', () => {
  const e = buildEconomy({ ...base, markets: { tiles: [tile('BLS:UNRATE', 4.1, { change: -0.1, points: [['2026-09-01', 4.2], ['2026-10-01', 4.1]] }), tile('BLS:PAYROLLS', 159293, { points: [['2026-09-01', 159128], ['2026-10-01', 159293]] })], currencies: [] } });
  assert.equal(e.jobs?.payrolls?.monthlyChangeThousands, 165);
  const k = e.keyNumbers.find((x) => x.id === 'unemployment')!;
  assert.equal(k.value, '4.1%');
  assert.equal(k.change, 'down 0.1 points from last month');
});

test('currencies are sorted by the size of the 30-day move and named in plain words', () => {
  const e = buildEconomy({ ...base, markets: { tiles: [], currencies: [{ quote: 'EUR', label: 'x', rate: 0.9, change30dPct: 1, asOf: 'd' }, { quote: 'TRY', label: 'x', rate: 40, change30dPct: -6, asOf: 'd' }, { quote: 'XXX', label: 'x', rate: 1, change30dPct: 0.2, asOf: 'd' }] } });
  assert.deepEqual(e.currencies.map((c) => c.name), ['Turkish lira', 'Euro', 'XXX']);
  const k = e.keyNumbers.find((x) => x.id === 'dollar')!;
  assert.equal(k.change, 'up 1.0% in 30 days');
});

test('commodities come from the commodity group only', () => {
  const e = buildEconomy({ ...base, markets: { tiles: [tile('IMF:POILBRE', 108.4, { group: 'Commodities', changePct: 6.2 }), tile('UST:10Y', 4.9, { group: 'Rates & dollar' })], currencies: [] } });
  assert.deepEqual(e.commodities.map((c) => c.id), ['IMF:POILBRE']);
  assert.equal(e.keyNumbers.find((x) => x.id === 'oil')?.change, 'up 6.2% from last month');
});

test('major economies appear only once at least six have a reading, with the year of each', () => {
  const ind = (id: string, vals: Record<string, number>) => ({ id, latestYear: 2025, standings: Object.fromEntries(Object.entries(vals).map(([cc, value]) => [cc, { value, year: cc === 'IN' ? 2024 : undefined }])) });
  const few = buildEconomy({ ...base, majors: { indicators: [ind('gdp_growth', { US: 2, CN: 5 })] } });
  assert.deepEqual(few.majorEconomies, []);
  const many = buildEconomy({ ...base, majors: { indicators: [ind('gdp_growth', { US: 2, CN: 5, JP: 1, DE: 0.4, IN: 6.5, GB: 1.1 }), ind('unemployment', { US: 4.1 })] } });
  assert.equal(many.majorEconomies.length, 12);
  assert.deepEqual(many.majorEconomies[0], { cc: 'US', growth: { value: 2, year: 2025 }, inflation: null, unemployment: { value: 4.1, year: 2025 } });
  assert.equal(many.majorEconomies.find((r) => r.cc === 'IN')?.growth?.year, 2024);
});

if (failures) {
  console.error(`${failures} test(s) failed`);
  process.exit(1);
}
console.log('All dashboard economy tests passed');
