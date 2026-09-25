// Same escaping rules as scripts/lib/sql.ts (kept as a separate copy, not a
// cross-import, so the Worker bundle doesn't reach into the standalone
// Node-only scripts/ directory). The one difference: buildInsertStatements
// returns an array of already-terminated statement strings, one per chunk,
// instead of one joined blob -- each element is passed straight to
// env.DB.prepare() and collected into a single atomic env.DB.batch() call.

export function sqlString(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function sqlJson(value: unknown): string {
  return sqlString(JSON.stringify(value ?? null));
}

// D1 rejects any single statement over 100KB (SQLITE_TOOBIG). A fixed row
// count per statement isn't safe against that on its own -- live source data
// varies in field length over time (a CSL refresh hit this in practice: some
// rows' free-text fields were long enough that 150 rows exceeded 100KB, even
// though the same row count was safe for an earlier snapshot of the same
// feed). So chunking is byte-size-aware first, row-count-capped second,
// whichever limit a given row would cross triggers starting a new statement.
const MAX_STATEMENT_BYTES = 90_000; // safety margin under D1's 100KB limit
const encoder = new TextEncoder();
const byteLength = (s: string) => encoder.encode(s).length;

// `suffix` is appended after the values list and before the terminating `;`
// -- e.g. an `ON CONFLICT(...) DO UPDATE SET ...` clause for callers doing an
// incremental upsert instead of the usual delete-then-reinsert (see
// lib/pulse/sync.ts). Every existing caller omits it and is unaffected.
export function buildInsertStatements(insertPrefix: string, rows: string[], rowsPerStatement = 200, suffix = ''): string[] {
  const statements: string[] = [];
  const prefixBytes = byteLength(insertPrefix) + 1;
  const suffixBytes = suffix ? byteLength(suffix) + 1 : 0;

  const flush = (chunk: string[]) => {
    if (chunk.length === 0) return;
    const body = `${insertPrefix}\n${chunk.join(',\n')}`;
    statements.push(suffix ? `${body}\n${suffix};` : `${body};`);
  };

  let chunk: string[] = [];
  let chunkBytes = prefixBytes + suffixBytes;

  for (const row of rows) {
    const rowBytes = byteLength(row) + 2; // ',\n' separator (an overestimate for the chunk's last row, which is fine -- it keeps this side of the limit, never the other)
    if (chunk.length > 0 && (chunk.length >= rowsPerStatement || chunkBytes + rowBytes > MAX_STATEMENT_BYTES)) {
      flush(chunk);
      chunk = [];
      chunkBytes = prefixBytes + suffixBytes;
    }
    chunk.push(row);
    chunkBytes += rowBytes;
  }
  flush(chunk);

  return statements;
}
