// Deterministic tests for the bulk-reload scheduler: which jobs run on a given
// day, so no single day can exceed D1's free-tier write cap. No network, no DB.
// Run: npm run test:unit

import assert from 'node:assert/strict';
import { pickDueBulkJobs, pickDueIndicatorJobs, plannedWrites, bulkWriteLimit } from '../src/scheduled.js';
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
const envWith = (log: { source: string; biggest: number | null; last_ok: string | null; fails?: number; written?: number | null }[], spentToday = 0) =>
  ({ DB: { prepare: () => ({ all: async () => ({ results: log }), first: async () => ({ spent: spentToday }) }) } }) as unknown as Env;

await test('the sanctions lists are not run in the Worker (they are synced by the GitHub workflow)', async () => {
  const picked = await pickDueBulkJobs(envWith([]), NOW);
  assert.ok(picked.every((j) => !['sdn', 'csl', 'un_sanctions', 'uk_sanctions'].includes(j.source)));
  assert.equal(picked[0].source, 'gta');
});

await test('nothing runs when every job succeeded within the week', async () => {
  const sources = ['sdn', 'csl', 'un_sanctions', 'uk_sanctions', 'gta', 'wro_findings', 'world_bank', 'power_indicators', 'un_voting', 'uis_students', 'unhcr', 'nobel', 'fts', 'hts', 'schedule_b', 'xref'];
  const picked = await pickDueBulkJobs(envWith(sources.map((source) => ({ source, biggest: 1000, last_ok: daysAgo(2) }))), NOW);
  assert.equal(picked.length, 0);
});

await test('HTS, Schedule B and the cross-reference are loaded by the GitHub workflow, never picked by the Worker (they cannot succeed on the free plan)', async () => {
  const stale = ['hts', 'schedule_b', 'xref'].map((source) => ({ source, biggest: 32_000, last_ok: daysAgo(30), fails: 9 }));
  const picked = await pickDueBulkJobs(envWith(stale), NOW);
  assert.ok(!picked.some((j) => ['hts', 'schedule_b', 'xref'].includes(j.source)));
});

await test('a job last run 7 days ago is due; the day budget is counted in measured writes', async () => {
  // gta wrote 25,000 rows last time (measured), wro_findings is small: both are due, 25k + 500 fits 30k.
  const log = [
    { source: 'gta', biggest: 3_000, written: 25_000, last_ok: daysAgo(7) },
    { source: 'wro_findings', biggest: 100, written: 400, last_ok: daysAgo(7) },
  ];
  assert.deepEqual((await pickDueBulkJobs(envWith(log), NOW)).map((j) => j.source), ['gta', 'wro_findings']);
  // The day already spent 60,000 writes: the cap and the 20,000 reserve leave 20,000, so after the first job the next one no longer fits.
  assert.deepEqual((await pickDueBulkJobs(envWith(log, 60_000), NOW)).map((j) => j.source), ['gta']);
});

await test('nothing heavy runs when the day has no headroom left', async () => {
  assert.equal(bulkWriteLimit(80_000), 0);
  assert.equal(bulkWriteLimit(0), 30_000);
  assert.equal((await pickDueBulkJobs(envWith([], 85_000), NOW)).length, 0);
});

await test('planned writes prefer the measured figure over declared rows', async () => {
  assert.equal(plannedWrites({ source: 'x', biggest: 100, written: 9_000, last_ok: null }, 50), 9_000);
  assert.equal(plannedWrites({ source: 'x', biggest: 100, written: null, last_ok: null }, 50), 500);
  assert.equal(plannedWrites(undefined, 50), 50);
});

await test('a failed-only job (no success on record) is still due', async () => {
  const picked = await pickDueBulkJobs(envWith([{ source: 'gta', biggest: null, last_ok: null }]), NOW);
  assert.equal(picked[0].source, 'gta');
});

await test('every indicator job fits the 40-request budget on a fresh install (World Bank series are batched)', async () => {
  const picked = await pickDueIndicatorJobs(envWith([]), NOW);
  const fetches: Record<string, number> = { world_bank: 2, power_indicators: 7, un_voting: 2, uis_students: 2, unhcr: 2, nobel: 4, fts: 9, undp_hdr: 2, openalex: 6 };
  assert.equal(picked.length, 9, picked.map((j) => j.source).join(','));
  assert.ok(picked.reduce((n, j) => n + fetches[j.source], 0) <= 40);
});

await test('indicator jobs that ran this week are not picked again', async () => {
  const log = ['world_bank', 'power_indicators', 'un_voting', 'uis_students', 'unhcr', 'nobel', 'undp_hdr', 'openalex'].map((source) => ({ source, biggest: 5, last_ok: daysAgo(1) }));
  assert.deepEqual((await pickDueIndicatorJobs(envWith(log), NOW)).map((j) => j.source), ['fts']);
});

await test('no indicator job is in the heavy reference-table group', async () => {
  const picked = await pickDueBulkJobs(envWith([]), NOW);
  assert.ok(!picked.some((j) => ['power_indicators', 'un_voting', 'uis_students', 'unhcr', 'nobel', 'fts', 'world_bank', 'undp_hdr', 'openalex'].includes(j.source)));
});

await test('a persistently failing first job does not starve the others', async () => {
  const picked = await pickDueBulkJobs(envWith([{ source: 'gta', biggest: null, last_ok: null, fails: 12 }]), NOW);
  assert.notEqual(picked[0].source, 'gta', 'a healthy due job must run before the failing one');
  assert.ok(picked.length > 0, 'the day still runs due jobs');
  const at = picked.findIndex((j) => j.source === 'gta');
  assert.ok(at === -1 || at === picked.length - 1, 'a failing job goes last (or waits), never ahead of healthy jobs');
});

await test('a failing job still runs when nothing else is due', async () => {
  const others = ['wro_findings'].map((source) => ({ source, biggest: 1000, last_ok: daysAgo(1) }));
  const picked = await pickDueBulkJobs(envWith([{ source: 'gta', biggest: null, last_ok: null, fails: 5 }, ...others]), NOW);
  assert.deepEqual(picked.map((j) => j.source), ['gta']);
});

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
