import assert from 'node:assert/strict';
import { Hono } from 'hono';
import { dbCache } from '../src/lib/dbCache.js';

// A one-table fake of the pulse_feed_state queries dbCache makes.
function fakeDb() {
  const rows = new Map<string, { last_success_at: string; last_note: string }>();
  return {
    rows,
    prepare(sql: string) {
      let args: unknown[] = [];
      const stmt = {
        bind: (...a: unknown[]) => ((args = a), stmt),
        first: async () => rows.get(args[0] as string) ?? null,
        run: async () => {
          rows.set(args[0] as string, { last_success_at: args[1] as string, last_note: args[2] as string });
          return {};
        },
      };
      void sql;
      return stmt;
    },
  };
}
let failures = 0;
async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (e) {
    failures++;
    console.log(`FAIL ${name}\n${e instanceof Error ? e.message : e}`);
  }
}
const make = (db: ReturnType<typeof fakeDb>, handler: () => Response | Promise<Response>, ttl = 60) => {
  const app = new Hono<{ Bindings: { DB: unknown } }>();
  app.use('/x', dbCache(ttl, (u) => u.toString()) as never);
  app.get('/x', () => handler());
  const env = { DB: db };
  const ctx = { waitUntil: (p: Promise<unknown>) => void p, passThroughOnException() {} };
  return (path = '/x') => app.request(path, {}, env as never, ctx as never);
};

await test('the second request is served from the stored row without running the handler', async () => {
  const db = fakeDb();
  let calls = 0;
  const get = make(db, () => (calls++, Response.json({ n: calls })));
  const a = await get();
  assert.equal(a.headers.get('X-Db-Cache'), 'MISS');
  await new Promise((r) => setTimeout(r, 5));
  const b = await get();
  assert.equal(b.headers.get('X-Db-Cache'), 'HIT');
  assert.deepEqual(await b.json(), { n: 1 });
  assert.equal(calls, 1);
});
await test('an expired row is rebuilt', async () => {
  const db = fakeDb();
  let calls = 0;
  const get = make(db, () => (calls++, Response.json({ n: calls })), 60);
  await get();
  await new Promise((r) => setTimeout(r, 5));
  for (const v of db.rows.values()) v.last_success_at = new Date(Date.now() - 120_000).toISOString();
  const b = await get();
  assert.deepEqual(await b.json(), { n: 2 });
});
await test('errors are not stored, and a stale copy covers a server error', async () => {
  const db = fakeDb();
  let fail = false;
  const get = make(db, () => (fail ? new Response('boom', { status: 500 }) : Response.json({ ok: true })));
  await get();
  await new Promise((r) => setTimeout(r, 5));
  for (const v of db.rows.values()) v.last_success_at = new Date(Date.now() - 120_000).toISOString();
  fail = true;
  const b = await get();
  assert.equal(b.status, 200);
  assert.equal(b.headers.get('X-Db-Cache'), 'STALE');
  const db2 = fakeDb();
  const get2 = make(db2, () => new Response('boom', { status: 500 }));
  assert.equal((await get2()).status, 500);
  assert.equal(db2.rows.size, 0);
});
if (failures) {
  console.log(`${failures} test(s) failed`);
  process.exit(1);
}
