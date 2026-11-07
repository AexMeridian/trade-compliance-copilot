// Regional value content arithmetic (src/lib/originMath.ts), checked against the hand-labelled origin scenarios: wherever the code settles
// a scenario, the answer must be one the labeller accepted. No network, no model. Run: npm run test:unit

import assert from 'node:assert/strict';
import { precheckRvc } from '../src/lib/originMath.js';
import { ORIGIN_SCENARIOS } from './accuracy/origin-set.js';

const RULES = {
  generic: { rule_type: 'tariff_shift_or_rvc', rvc_threshold_pct: 60, rvc_method: 'either', citation: 'GN 11' },
  auto: { rule_type: 'rvc', rvc_threshold_pct: 75, rvc_method: 'net_cost', citation: 'GN 11 autos' },
};
const ruleFor = (code: string) => (/^870[34]/.test(code) ? RULES.auto : /^(84|85|87)/.test(code) ? RULES.generic : null);

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

test('wherever the arithmetic settles a labelled scenario it agrees with the label', () => {
  let settled = 0;
  for (const s of ORIGIN_SCENARIOS) {
    const rule = ruleFor(s.code);
    if (!rule || !['US', 'CA', 'MX'].includes(s.assembly)) continue; // other assembly countries are settled earlier, in the route
    const r = precheckRvc(rule as never, s.components);
    if (!r) continue;
    settled++;
    assert.ok(s.accept.includes(r.qualifies ? 'true' : 'false'), `${s.name}: code says ${r.qualifies}, label accepts ${s.accept.join('/')}`);
  }
  assert.ok(settled >= 10, `only ${settled} scenarios settled`);
  console.log(`     ${settled} scenarios settled by arithmetic`);
});
test('exactly at the threshold qualifies; just under does not (rvc-only rule)', () => {
  const comps = (us: number) => [{ description: 'a', origin_country: 'US', value_pct: us }, { description: 'b', origin_country: 'JP', value_pct: 100 - us }];
  assert.equal(precheckRvc(RULES.auto as never, comps(75))?.qualifies, true);
  assert.equal(precheckRvc(RULES.auto as never, comps(74.9))?.qualifies, false);
});
test('an either-route rule below the threshold is left to the model', () => {
  assert.equal(precheckRvc(RULES.generic as never, [{ description: 'a', origin_country: 'US', value_pct: 50 }, { description: 'b', origin_country: 'CN', value_pct: 50 }]), null);
});
test('missing values or shares that do not add to 100 are left to the model', () => {
  assert.equal(precheckRvc(RULES.auto as never, [{ description: 'a', origin_country: 'US', value_pct: null }]), null);
  assert.equal(precheckRvc(RULES.auto as never, [{ description: 'a', origin_country: 'US', value_pct: 80 }]), null);
});
test('rules without a value threshold are left to the model', () => {
  assert.equal(precheckRvc({ rule_type: 'tariff_shift', rvc_threshold_pct: null, rvc_method: '', citation: 'x' } as never, [{ description: 'a', origin_country: 'US', value_pct: 100 }]), null);
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
