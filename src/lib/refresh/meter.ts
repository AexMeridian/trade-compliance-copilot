// Counts the D1 rows a job really wrote. D1 reports `meta.rows_written` on every run()/all()/batch() result, and that figure includes the
// index and full-text-search entries each row costs, which is what the free plan's 100,000-writes-per-day cap counts. The scheduler wraps
// each job's database binding with this, records the total in data_refresh_log.rows_written, and budgets later days on it (scheduled.ts).

export interface WriteMeter {
  db: D1Database;
  /** Writes measured so far. */
  written: () => number;
}

/** True when an error looks like D1 refusing writes because the day's allowance is used up. */
export function isWriteQuotaError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /rows? written|write limit|daily.*(limit|quota)|exceeded.*(limit|quota)|D1.*(limit|quota)/i.test(message);
}

export function meterDb(db: D1Database): WriteMeter {
  let total = 0;
  const add = <T>(result: T): T => {
    const w = (result as { meta?: { rows_written?: unknown } } | null | undefined)?.meta?.rows_written;
    if (typeof w === 'number' && Number.isFinite(w)) total += w;
    return result;
  };
  const originals = new WeakMap<object, D1PreparedStatement>();
  const wrap = (stmt: D1PreparedStatement): D1PreparedStatement => {
    const proxy = new Proxy(stmt, {
      get(target, prop) {
        const value = (target as unknown as Record<string | symbol, unknown>)[prop];
        if (prop === 'bind') return (...args: unknown[]) => wrap((value as (...a: unknown[]) => D1PreparedStatement).apply(target, args));
        if (prop === 'run' || prop === 'all') return async (...args: unknown[]) => add(await (value as (...a: unknown[]) => Promise<unknown>).apply(target, args));
        return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
      },
    });
    originals.set(proxy, stmt);
    return proxy;
  };
  const metered = new Proxy(db, {
    get(target, prop) {
      const value = (target as unknown as Record<string | symbol, unknown>)[prop];
      if (prop === 'prepare') return (sql: string) => wrap(target.prepare(sql));
      if (prop === 'batch') {
        return async (statements: D1PreparedStatement[]) => {
          const results = await target.batch(statements.map((s) => originals.get(s) ?? s));
          for (const r of results) add(r);
          return results;
        };
      }
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
  return { db: metered, written: () => total };
}
