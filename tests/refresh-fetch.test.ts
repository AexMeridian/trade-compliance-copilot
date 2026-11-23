// The OpenAlex and Treasury fetchers: a rate limit (HTTP 429) is waited out and retried, a slow answer is retried once, the polite-pool address is sent
// when configured, and a failure names its cause. No network (fetch is replaced). Run: npm run test:unit
import assert from 'node:assert/strict';
import { openAlexJson } from '../src/lib/refresh/openalex.js';
import { fetchText } from '../src/lib/pulse/treasury.js';
import { meterDb, isWriteQuotaError } from '../src/lib/refresh/meter.js';

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
const realFetch = globalThis.fetch;
const stub = (answers: (Response | Error)[], seen: string[] = []) => {
  globalThis.fetch = (async (url: string) => {
    seen.push(String(url));
    const a = answers.shift();
    if (!a) throw new Error('unexpected extra request');
    if (a instanceof Error) throw a;
    return a;
  }) as typeof fetch;
  return seen;
};
const json = (body: unknown, status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers });

await test('OpenAlex: a 429 is retried after the Retry-After pause, and the mailto is added', async () => {
  const waits: number[] = [];
  const seen = stub([json({}, 429, { 'retry-after': '2' }), json({ group_by: [] })]);
  const body = await openAlexJson('https://api.openalex.org/works?filter=x', 'ops@example.org', 4, async (ms) => void waits.push(ms));
  assert.deepEqual(body, { group_by: [] });
  assert.deepEqual(waits, [2000]);
  assert.match(seen[0], /&mailto=ops%40example\.org$/);
});

await test('OpenAlex: no mailto when none is configured; a persistent 429 fails with the status after the allowed attempts', async () => {
  const seen = stub([json({}, 429), json({}, 429), json({}, 429)]);
  await assert.rejects(openAlexJson('https://api.openalex.org/works?filter=x', undefined, 3, async () => undefined), /HTTP 429 from api\.openalex\.org/);
  assert.equal(seen.length, 3);
  assert.ok(!seen[0].includes('mailto'));
});

await test('OpenAlex: a 404 is not retried', async () => {
  const seen = stub([json({}, 404)]);
  await assert.rejects(openAlexJson('https://api.openalex.org/works', undefined, 4, async () => undefined), /HTTP 404/);
  assert.equal(seen.length, 1);
});

await test('Treasury: a timeout is retried once and succeeds; a second failure names the cause', async () => {
  stub([Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' }), new Response('ok')]);
  assert.equal(await fetchText('https://ticdata.treasury.gov/x.txt'), 'ok');
  stub([Object.assign(new Error('timeout'), { name: 'TimeoutError' }), Object.assign(new Error('timeout'), { name: 'TimeoutError' })]);
  await assert.rejects(fetchText('https://ticdata.treasury.gov/x.txt', 30_000), /ticdata\.treasury\.gov\/x\.txt\): no answer within 30 s/);
  stub([new Response('nope', { status: 404 })]);
  await assert.rejects(fetchText('https://home.treasury.gov/y?z=1'), /home\.treasury\.gov\/y\): HTTP 404/);
});

await test('meter: sums meta.rows_written over run(), all() and batch(); quota errors are recognised', async () => {
  const stmt = (written: number) => ({ bind() { return this; }, run: async () => ({ meta: { rows_written: written } }), all: async () => ({ results: [], meta: { rows_written: 0 } }) });
  const db = { prepare: () => stmt(7), batch: async (list: unknown[]) => list.map(() => ({ meta: { rows_written: 5 } })) } as unknown as D1Database;
  const m = meterDb(db);
  await m.db.prepare('x').bind(1).run();
  await m.db.batch([m.db.prepare('a'), m.db.prepare('b')]);
  assert.equal(m.written(), 17);
  assert.equal(isWriteQuotaError(new Error('D1 DB reached its daily rows written limit')), true);
  assert.equal(isWriteQuotaError(new Error('HTTP 500')), false);
});

globalThis.fetch = realFetch;
if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
