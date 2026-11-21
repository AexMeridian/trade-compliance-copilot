// Regression tests for the calculator's truthfulness fixes of November 2026: Section 232 scope forcing review, the base 232 rows keeping no
// end date, candidate trimming, mojibake repair, and the retired "cleared" wording. No network, no model, no database. Run: npm run test:unit

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { section232ScopeCheck } from '../src/lib/dutyStack.js';
import { shownCandidates } from '../src/lib/candidateList.js';
import { repairMojibake, looksMojibake } from '../src/lib/textRepair.js';

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

test('metal-derivative chapters force review because metal content is unknown', () => {
  for (const code of ['7318.15.20', '7408.11.00', '7616.99.51', '8302.41.60', '8419.50.50', '8536.50.90', '8714.10.00'.replace('8714', '8708')]) {
    assert.equal(section232ScopeCheck(code, 'VN').forceReview, true, code);
  }
  assert.equal(section232ScopeCheck('0808.10.00', 'SE').forceReview, false);
  assert.equal(section232ScopeCheck('6109.10.00', 'VN').forceReview, false);
});
test('autos force review with the reason, and chapter 74 carries a scope caveat', () => {
  const auto = section232ScopeCheck('8703.23.01', 'DE');
  assert.equal(auto.forceReview, true);
  assert.match(auto.issues.join(' '), /differ by origin/);
  assert.match(section232ScopeCheck('7403.11.00', 'CL').issues.join(' '), /chapter 74/);
});

test('migration 0031 clears the end date on the three base 232 rows only', () => {
  const sql = readFileSync('migrations/0031_sec232_base_rows_no_expiry.sql', 'utf8').replace(/--.*$/gm, '');
  assert.match(sql, /SET expiration_date = NULL/);
  assert.match(sql, /'sec232_steel', 'sec232_aluminum', 'sec232_copper'/);
  assert.match(sql, /country_scope IS NULL/);
  assert.doesNotMatch(sql, /sec232_metals_country_cap/);
});

test('zero-score candidates are hidden, at most five stay, and the selection is always listed with a reason', () => {
  const all = Array.from({ length: 12 }, (_, i) => ({ code: `0000.00.${String(i).padStart(2, '0')}`, description: `d${i}`, score: i < 3 ? 0 : 10 - i }));
  const shown = shownCandidates(all, '0000.00.00', ['0000.00.05']);
  assert.ok(shown.length <= 5);
  assert.equal(shown[0].code, '0000.00.00'); // selected, though its score is 0
  assert.ok(shown.every((c) => c.reason));
  assert.ok(!shown.some((c) => c.score === 0 && c.code !== '0000.00.00'));
  assert.equal(shownCandidates(all.slice(0, 3), null).length, 0);
});

test('mojibake from a double UTF-8 decode is repaired, and clean text is untouched', () => {
  const damaged = 'Step 1 â€” Restate the rule, 2 Ã— 3, â‰¥ 50%';
  assert.equal(looksMojibake(damaged), true);
  const fixed = repairMojibake(damaged);
  assert.equal(fixed, 'Step 1 — Restate the rule, 2 × 3, ≥ 50%');
  assert.equal(looksMojibake(fixed), false);
  const clean = 'Café â — fine Ã';
  assert.equal(repairMojibake(clean), clean);
  assert.equal(repairMojibake('plain ascii'), 'plain ascii');
});

test('the retired wording does not return to the calculator pages', () => {
  const files = ['frontend/src/pages/Landing.tsx', 'frontend/src/pages/Report.tsx', 'frontend/src/pages/CaseWizard.tsx', 'frontend/src/components/VerdictBanner.tsx', 'frontend/src/components/DutyStackTable.tsx'];
  const banned = /Cleared \(false positive\)|all cleared|Everything clears|never guessed|landed[- ]cost|de minimis check|often, but not always/i;
  for (const f of files) {
    const hits = readFileSync(f, 'utf8').split(/\r?\n/).filter((l) => banned.test(l) && !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l));
    assert.deepEqual(hits, [], `${f}: ${hits.join(' | ')}`);
  }
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
