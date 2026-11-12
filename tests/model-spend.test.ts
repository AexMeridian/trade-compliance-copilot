// Spend estimates and the rule that decides which model errors stop the calculator (src/lib/modelSpend.ts). No network, no model.
// Run: npm run test:unit

import assert from 'node:assert/strict';
import { classifyModelError, estimateUsd, monthStart, monthlyBudgetUsd, DEFAULT_MONTHLY_BUDGET_USD } from '../src/lib/modelSpend.js';

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

test('cost is tokens times the per-million price', () => {
  assert.equal(estimateUsd(1_000_000, 0), 3);
  assert.equal(estimateUsd(0, 1_000_000), 15);
  assert.ok(Math.abs(estimateUsd(1666, 1154) - 0.0223) < 0.0001); // the measured origin call
});
test('month start is the first of the month in UTC', () => {
  assert.equal(monthStart(new Date('2026-11-30T23:59:59Z')), '2026-11-01');
  assert.equal(monthStart(new Date('2027-01-01T00:00:00Z')), '2027-01-01');
});
test('budget falls back to the default for missing or bad values', () => {
  assert.equal(monthlyBudgetUsd(undefined), DEFAULT_MONTHLY_BUDGET_USD);
  assert.equal(monthlyBudgetUsd('abc'), DEFAULT_MONTHLY_BUDGET_USD);
  assert.equal(monthlyBudgetUsd('0'), DEFAULT_MONTHLY_BUDGET_USD);
  assert.equal(monthlyBudgetUsd('-5'), DEFAULT_MONTHLY_BUDGET_USD);
  assert.equal(monthlyBudgetUsd('12.5'), 12.5);
});
test('the out-of-credit error is recognised', () => {
  const err = { status: 400, message: '400 {"type":"error","error":{"type":"invalid_request_error","message":"Your credit balance is too low to access the Anthropic API."}}' };
  assert.equal(classifyModelError(err), 'credit');
});
test('bad credentials are recognised', () => {
  assert.equal(classifyModelError({ status: 401, message: 'invalid x-api-key' }), 'auth');
  assert.equal(classifyModelError({ status: 403, message: 'forbidden' }), 'auth');
});
test('ordinary failures are not treated as account problems', () => {
  assert.equal(classifyModelError({ status: 400, message: 'max_tokens too large' }), null);
  assert.equal(classifyModelError({ status: 429, message: 'rate limited' }), null);
  assert.equal(classifyModelError({ status: 500, message: 'server error' }), null);
  assert.equal(classifyModelError(new Error('timeout')), null);
  assert.equal(classifyModelError(null), null);
  assert.equal(classifyModelError('credit balance is too low'), null);
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
