// Deterministic tests for the edge cache middleware: fresh hits, expiry, and serving the last good copy when the origin fails.
// Run: npm run test:unit

import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { edgeCache } from '../src/lib/edgeCache.js';

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

// A minimal in-memory stand-in for the Workers Cache API.
function fakeCache() {
  const store = new Map<string, Response>();
  return {
    match: async (req: Request) => store.get(req.url)?.clone(),
    put: async (req: Request, res: Response) => void store.set(req.url, res),
  };
}
(globalThis as unknown as { caches: { default: ReturnType<typeof fakeCache> } }).caches = { default: fakeCache() };

const ctx = { waitUntil: (p: Promise<unknown>) => void p, passThroughOnException: () => {} } as unknown as ExecutionContext;
function appWith(handler: () => Response | Promise<Response>, ttl: number) {
  const app = new Hono();
  app.use('/x', edgeCache(ttl));
  app.get('/x', () => handler());
  return app;
}

await test('second request is a cache hit and does not reach the handler', async () => {
  let calls = 0;
  const app = appWith(() => (calls++, new Response('one')), 60);
  const a = await app.request('http://t/x?a=1', {}, {}, ctx);
  await new Promise((r) => setTimeout(r, 5));
  const b = await app.request('http://t/x?a=1', {}, {}, ctx);
  assert.equal(a.headers.get('X-Edge-Cache'), 'MISS');
  assert.equal(b.headers.get('X-Edge-Cache'), 'HIT');
  assert.equal(await b.text(), 'one');
  assert.equal(calls, 1);
  assert.equal(b.headers.get('Cache-Control'), 'public, max-age=60');
});

await test('an expired entry is refreshed when the handler works', async () => {
  let n = 0;
  const app = appWith(() => new Response(`v${++n}`), 0);
  await app.request('http://t/x?b=1', {}, {}, ctx);
  await new Promise((r) => setTimeout(r, 5));
  const second = await app.request('http://t/x?b=1', {}, {}, ctx);
  assert.equal(await second.text(), 'v2');
});

await test('an expired entry is served stale when the handler fails', async () => {
  let fail = false;
  const app = appWith(() => (fail ? new Response('down', { status: 503 }) : new Response('good')), 0);
  await app.request('http://t/x?c=1', {}, {}, ctx);
  await new Promise((r) => setTimeout(r, 5));
  fail = true;
  const res = await app.request('http://t/x?c=1', {}, {}, ctx);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'good');
  assert.equal(res.headers.get('X-Edge-Cache'), 'STALE');
});

await test('with nothing cached, a failure is passed through', async () => {
  const app = appWith(() => new Response('down', { status: 503 }), 60);
  const res = await app.request('http://t/x?d=1', {}, {}, ctx);
  assert.equal(res.status, 503);
});

await test('a miss over the limit gets the stale copy when there is one, otherwise a 429, and hits are never limited', async () => {
  let allow = true;
  const env = { MISS_RATE_LIMITER: { limit: async () => ({ success: allow }) } };
  let calls = 0;
  const app = appWith(() => (calls++, new Response('v')), 0.001);
  const first = await app.request('http://t/x?m=1', {}, env, ctx);
  assert.equal(first.status, 200);
  await new Promise((r) => setTimeout(r, 30)); // the entry is now stale
  allow = false;
  const stale = await app.request('http://t/x?m=1', {}, env, ctx);
  assert.equal(stale.headers.get('X-Edge-Cache'), 'STALE');
  assert.equal(calls, 1, 'a limited request must not reach the handler');
  const fresh = await app.request('http://t/x?m=2', {}, env, ctx);
  assert.equal(fresh.status, 429);
  assert.equal(fresh.headers.get('Retry-After'), '30');
  assert.equal(calls, 1);
});

if (failures) {
  console.error(`\n${failures} FAIL`);
  process.exit(1);
}
