import type { Hono } from 'hono';
import type { Env } from '../../types/env.js';

export type PulseApp = Hono<{ Bindings: Env }>;

/** Parses and clamps a query-string integer param, defaulting on anything
 * missing or non-numeric. Using `Number.isFinite` (rather than `Number(x) ||
 * fallback`, which every call site here used to repeat) means an explicit
 * `0` from the caller is respected instead of silently replaced by the
 * default. */
export function clampInt(raw: string | undefined, opts: { default: number; min: number; max?: number }): number {
  const n = raw === undefined || raw === '' ? NaN : Number(raw);
  const v = Number.isFinite(n) ? n : opts.default;
  const withMin = Math.max(v, opts.min);
  return opts.max !== undefined ? Math.min(withMin, opts.max) : withMin;
}

/** Splits a comma-separated query param into a trimmed, non-empty list, so
 * `?country=CN,MX,CA` reads the same as three separate values -- the
 * no-account alternative to a saved multi-select filter (procurement's "alert
 * me about Section 301 and Section 232 for these three countries" needs both
 * this and the `q` multi-keyword support below). Returns [] for a missing or
 * empty param, which the callers below treat as "no filter." */
export function csvParam(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The UI shows at most two lines of an abstract; sending the full text on list endpoints is most of their weight. */
export function slimAction<T extends { abstract: string | null }>(a: T): T {
  const max = 280;
  return a.abstract && a.abstract.length > max ? { ...a, abstract: `${a.abstract.slice(0, max).trimEnd()}…` } : a;
}
