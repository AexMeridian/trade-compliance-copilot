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
 */
export function buildBatchedInserts(
  insertPrefix: string,
  rows: string[],
  rowsPerStatement = 200
): string {
  const statements: string[] = [];
  for (let i = 0; i < rows.length; i += rowsPerStatement) {
    const chunk = rows.slice(i, i + rowsPerStatement);
    statements.push(`${insertPrefix}\n${chunk.join(',\n')};`);
  }
  return statements.join('\n\n');
}
