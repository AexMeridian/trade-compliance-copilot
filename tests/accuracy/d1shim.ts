// A read-only stand-in for the D1 binding, backed by the local database file that `wrangler dev` creates, so the accuracy tests can run the
// calculator's real query code (src/lib/db.ts) without a server. Only the calls that code makes are supported. Returns null when no
// seeded local database exists.

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Env } from '../../src/types/env.js';

const DIR = '.wrangler/state/v3/d1/miniflare-D1DatabaseObject';

export function openLocalDb(): DatabaseSync | null {
  if (!existsSync(DIR)) return null;
  const file = readdirSync(DIR)
    .filter((f) => f.endsWith('.sqlite'))
    .map((f) => join(DIR, f))
    .sort((a, b) => statSync(b).size - statSync(a).size)[0];
  return file ? new DatabaseSync(file, { readOnly: true }) : null;
}

function statement(db: DatabaseSync, sql: string, args: unknown[] = []) {
  const run = () => db.prepare(sql);
  const stmt = {
    bind: (...a: unknown[]) => statement(db, sql, a),
    all: async <T>() => ({ results: run().all(...(args as never[])) as T[] }),
    first: async <T>() => (run().get(...(args as never[])) as T | undefined) ?? null,
  };
  return stmt;
}

export function d1Env(db: DatabaseSync): Env {
  return { DB: { prepare: (sql: string) => statement(db, sql) } } as unknown as Env;
}
