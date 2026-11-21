// Applies every migration, in order, to a real in-memory SQLite database (node:sqlite, which includes FTS5, as D1 does), so a statement
// that parses badly or depends on a table that does not exist yet fails here and not during `npm run db:migrate:remote`.
// No network. Run: npm run test:unit
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { EXPECTED_TABLES } from '../src/lib/health.js';

const files = readdirSync('migrations').filter((f) => f.endsWith('.sql')).sort();
const db = new DatabaseSync(':memory:');
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

test('every migration applies cleanly, in order', () => {
  for (const f of files) {
    try {
      db.exec(readFileSync(`migrations/${f}`, 'utf8'));
    } catch (err) {
      throw new Error(`${f}: ${(err as Error).message}`);
    }
  }
});

test('all the tables the health check expects exist afterwards', () => {
  const have = new Set((db.prepare(`SELECT name FROM sqlite_master WHERE type = 'table'`).all() as { name: string }[]).map((r) => r.name.toLowerCase()));
  const missing = EXPECTED_TABLES.filter((t) => !have.has(t));
  assert.deepEqual(missing, []);
});

test('the tables the app writes to accept a row of the shape the code uses', () => {
  db.prepare(`INSERT INTO data_refresh_log (source, status, rows_affected, error_message, started_at, finished_at) VALUES ('sdn', 'error', NULL, 'x', 'a', 'b')`).run();
  db.prepare(`INSERT INTO alert_state (key, status, detail, first_seen_at, last_seen_at) VALUES ('k', 'ok', NULL, 'a', 'a')`).run();
  db.prepare(`INSERT INTO pulse_feed_state (source_key, last_note) VALUES ('claude-calls:2026-01-01', '1')`).run();
});

if (failures) {
  console.error(`\n${failures} test(s) failed`);
  process.exit(1);
}
