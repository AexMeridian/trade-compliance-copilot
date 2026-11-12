// Migration files: numbered without gaps or repeats, each non-empty, no table created twice. A bad file fails here instead of in the build
// step that applies migrations to the live database. No network. Run: npm run test:unit

import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

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

const files = readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort();

test('files are named NNNN_name.sql and numbered 1..N with no gaps or repeats', () => {
  const numbers = files.map((f) => {
    const m = /^(\d{4})_[a-z0-9_]+\.sql$/.exec(f);
    assert.ok(m, `bad name: ${f}`);
    return Number(m[1]);
  });
  numbers.forEach((n, i) => assert.equal(n, i + 1, `expected ${i + 1} at position ${i}, found ${n} (${files[i]})`));
});
test('every file has statements', () => {
  for (const f of files) {
    const sql = readFileSync(`migrations/${f}`, 'utf8').replace(/--.*$/gm, '').trim();
    assert.ok(sql.length > 0, `${f} is empty`);
  }
});
test('no table is created twice', () => {
  const seen = new Map<string, string>();
  for (const f of files) {
    const sql = readFileSync(`migrations/${f}`, 'utf8').replace(/--.*$/gm, '');
    for (const m of sql.matchAll(/CREATE\s+(?:VIRTUAL\s+)?TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_0-9]+)/gi)) {
      const name = m[1].toLowerCase();
      assert.ok(!seen.has(name), `${name} is created in both ${seen.get(name)} and ${f}`);
      seen.set(name, f);
    }
  }
});

if (failures > 0) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
