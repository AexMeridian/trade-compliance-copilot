// Deterministic tests for the bulk-reload scheduler: which jobs run on a given
// day, so no single day can exceed D1's free-tier write cap. No network, no DB.
// Run: npm run test:unit

import assert from 'node:assert/strict';
import { pickDueBulkJobs } from '../src/scheduled.js';
import type { Env } from '../src/types/env.js';

let failures = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL ${name}\n  ${(err as Error).message}`);
  }
}

const NOW = Date.parse('2026-10-07T05:00:00Z');
const daysAgo = (d: number) => new Date(NOW - d * 86_400_000).toISOString();
const envWith = (log: { source: string; biggest: number | null; last_ok: string | null }[]) =>
  ({ DB: { prepare: () => ({ all: async () => ({ results: log }) }) } }) as unknown as Env;

await test('a fresh install runs the first (biggest, highest-priority) job alone', async () => {
  const picked = await pickDueBulkJobs(envWith([]), NOW);
  assert.equal(picked[0].source, 'sdn');
  assert.ok(picked.every((j) => j.source !== 'hts'), 'hts must not share a day with sdn');
});

await test('nothing runs when every job succeeded within the week', async () => {
  const sources = ['sdn', 'csl', 'un_sanctions', 'uk_sanctions', 'gta', 'wro_findings', 'hts', 'schedule_b', 'xref'];
  const picked = await pickDueBulkJobs(envWith(sources.map((source) => ({ source, biggest: 1000, last_ok: daysAgo(2) }))), NOW);
  assert.equal(picked.length, 0);
});

await test('a job last run 7 days ago is due; its size is capped by the daily budget', async () => {
  const log = [
    { source: 'sdn', biggest: 44_000, last_ok: daysAgo(1) },
    { source: 'csl', biggest: 7_000, last_ok: daysAgo(1) },
    { source: 'un_sanctions', biggest: 3_000, last_ok: daysAgo(1) },
    { source: 'uk_sanctions', biggest: 8_000, last_ok: daysAgo(1) },
    { source: 'gta', biggest: 3_000, last_ok: daysAgo(1) },
    { source: 'wro_findings', biggest: 100, last_ok: daysAgo(1) },
    { source: 'hts', biggest: 32_000, last_ok: daysAgo(7) },
    { source: 'schedule_b', biggest: 15_000, last_ok: daysAgo(7) },
    { source: 'xref', biggest: 30_000, last_ok: daysAgo(7) },
  ];
  const picked = await pickDueBulkJobs(envWith(log), NOW);
  assert.deepEqual(picked.map((j) => j.source), ['hts']); // 32k used the budget; schedule_b/xref wait a day
});

await test('a failed-only job (no success on record) is still due', async () => {
  const picked = await pickDueBulkJobs(envWith([{ source: 'sdn', biggest: null, last_ok: null }]), NOW);
  assert.equal(picked[0].source, 'sdn');
});

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
