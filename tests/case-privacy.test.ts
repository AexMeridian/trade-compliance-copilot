// Who may add to a case: only the holder of the case's token. Reading by link stays open (the routes do that). No network. Run: npm run test:unit
import assert from 'node:assert/strict';
import { canWriteCase } from '../src/lib/caseStore.js';
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
const sha = async (s: string) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, '0')).join('');
const envWith = (row: { delete_token_hash: string | null; is_sample: number } | null) => ({ DB: { prepare: () => ({ bind: () => ({ first: async () => row }) }) } }) as unknown as Env;

await test('the right token may write; a wrong, empty or missing token may not', async () => {
  const env = envWith({ delete_token_hash: await sha('secret'), is_sample: 0 });
  assert.equal(await canWriteCase(env, 'id', 'secret'), true);
  assert.equal(await canWriteCase(env, 'id', 'other'), false);
  assert.equal(await canWriteCase(env, 'id', ''), false);
  assert.equal(await canWriteCase(env, 'id', undefined), false);
});
await test('samples are read-only; a case with no stored token (older or local) stays open; a missing case is left to the route to report', async () => {
  assert.equal(await canWriteCase(envWith({ delete_token_hash: await sha('x'), is_sample: 1 }), 'id', 'x'), false);
  assert.equal(await canWriteCase(envWith({ delete_token_hash: null, is_sample: 0 }), 'id', undefined), true);
  assert.equal(await canWriteCase(envWith(null), 'id', undefined), true);
});

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
