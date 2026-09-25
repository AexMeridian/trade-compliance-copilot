// Shared helpers for the bulk data loader scripts: SQL string escaping and
// chunked batch-file writing so no single generated .sql file risks tripping
// D1's 100KB-per-statement limit (see migrations/README notes / build plan).

export function sqlString(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function sqlJson(value: unknown): string {
  return sqlString(JSON.stringify(value ?? null));
}

export function sqlNum(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'NULL';
  return String(value);
}

export function sqlInt(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'NULL';
  return String(Math.trunc(value));
}

/**
 * Writes `rows` (each already a parenthesized "(...)" value tuple string) as one
 * or more INSERT statements, capping each statement's row count so the rendered
 * SQL text stays comfortably under D1's 100KB single-statement limit.
 *
 * A fixed row count alone isn't sufficient: live source data's field lengths
 * vary between refreshes (a CSL refresh once hit SQLITE_TOOBIG at the same
 * 150-row chunk size that was safe for an earlier snapshot of the same feed),
 * so chunking is byte-size-aware first, row-count-capped second -- whichever
 * limit a given row would cross triggers starting a new statement.
 */
const MAX_STATEMENT_BYTES = 90_000; // safety margin under D1's 100KB limit
const encoder = new TextEncoder();
const byteLength = (s: string) => encoder.encode(s).length;

export function buildBatchedInserts(
  insertPrefix: string,
  rows: string[],
  rowsPerStatement = 200
): string {
  const statements: string[] = [];
  const prefixBytes = byteLength(insertPrefix) + 1;
  let chunk: string[] = [];
  let chunkBytes = prefixBytes;

  const flush = () => {
    if (chunk.length === 0) return;
    statements.push(`${insertPrefix}\n${chunk.join(',\n')};`);
    chunk = [];
    chunkBytes = prefixBytes;
  };

  for (const row of rows) {
    const rowBytes = byteLength(row) + 2;
    if (chunk.length > 0 && (chunk.length >= rowsPerStatement || chunkBytes + rowBytes > MAX_STATEMENT_BYTES)) {
      flush();
    }
    chunk.push(row);
    chunkBytes += rowBytes;
  }
  flush();

  return statements.join('\n\n');
}
