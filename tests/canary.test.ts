// The built-in accuracy checks (src/lib/canary.ts). The arithmetic and license checks always run; the data checks run when a seeded local
// database exists. If this fails, either the code changed an answer that must not change, or a canary record really changed upstream.
// No network, no model. Run: npm run test:unit

import assert from 'node:assert/strict';
import { runLogicCanaries, runDataCanaries } from '../src/lib/canary.js';
import { d1Env, openLocalDb } from './accuracy/d1shim.js';

let failures = 0;
async function test(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`ok   ${name}`);
  } catch (err) {
    failures++;
    console.error(`FAIL ${name}\n  ${(err as Error).message}`);
  }
}

await test('arithmetic and license canaries all pass', () => {
  const failed = runLogicCanaries().filter((r) => !r.ok);
  assert.deepEqual(failed, []);
});

const db = openLocalDb();
if (!db) {
  console.log('skip data canaries: no seeded local database');
} else {
  await test('data canaries pass against the loaded data', async () => {
    const results = await runDataCanaries(d1Env(db));
    assert.ok(results.length >= 6, `only ${results.length} data canaries ran`);
    const failed = results.filter((r) => !r.ok);
    assert.deepEqual(failed, []);
  });
}

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
