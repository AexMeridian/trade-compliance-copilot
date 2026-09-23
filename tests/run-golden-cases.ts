// Runs each golden case through Module 1 (classification) against the real
// running app (wrangler dev) and reports accuracy against the expected
// HTS/Schedule-B prefix. This is a real accuracy signal, not a fabricated
// number -- it calls the live Claude-backed endpoint for every case.
//
// Requires `wrangler dev` running on http://127.0.0.1:8787 (or set BASE_URL).

import { readFileSync } from 'node:fs';

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:8787';

interface GoldenCase {
  direction: 'import' | 'export';
  product_description: string;
  expected_hts_prefix?: string;
  expected_schedule_b_prefix?: string;
  source: string;
}

async function main() {
  const cases: GoldenCase[] = JSON.parse(readFileSync('tests/golden-cases.json', 'utf-8'));

  const health = await fetch(`${BASE_URL}/api/health`).catch(() => null);
  if (!health || !health.ok) {
    console.error(`Cannot reach ${BASE_URL} -- start \`wrangler dev\` first.`);
    process.exit(1);
  }

  let pass = 0;
  const results: { description: string; expected: string; actual: string | null; ok: boolean }[] = [];

  for (const gc of cases) {
    const expected = gc.expected_hts_prefix ?? gc.expected_schedule_b_prefix ?? '';
    const createRes = await fetch(`${BASE_URL}/api/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction: gc.direction }),
    });
    const { id } = (await createRes.json()) as { id: string };

    const clsRes = await fetch(`${BASE_URL}/api/cases/${id}/classification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_description: gc.product_description }),
    });
    if (!clsRes.ok) {
      results.push({ description: gc.product_description, expected, actual: null, ok: false });
      continue;
    }
    const body = (await clsRes.json()) as { classification: { selected_code: string | null } };
    const actual = body.classification.selected_code;
    const digits = (actual ?? '').replace(/\./g, '');
    const expectedDigits = expected.replace(/\./g, '');
    const ok = digits.startsWith(expectedDigits);
    if (ok) pass++;
    results.push({ description: gc.product_description, expected, actual, ok });
  }

  console.log('\nGolden case results:');
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  expected ${r.expected.padEnd(10)} got ${(r.actual ?? '(none)').padEnd(14)} -- ${r.description.slice(0, 60)}`);
  }
  console.log(`\n${pass}/${cases.length} passed (${((pass / cases.length) * 100).toFixed(0)}%)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
