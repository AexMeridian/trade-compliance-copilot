// Small helpers for the public Worker's abuse controls: a constant-time secret check, a per-visitor daily quota for the model-calling
// routes, and a fail-open wrapper for the rate limiter binding (a limiter outage must not take the whole site down).
import type { Env } from '../types/env.js';

/** Compares two strings without leaking, through timing, how many leading characters matched. An empty secret never matches. */
export function safeEqual(given: string | null | undefined, secret: string | null | undefined): boolean {
  if (!secret || !given) return false;
  const enc = new TextEncoder();
  const a = enc.encode(given);
  const b = enc.encode(secret);
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a[i % (a.length || 1)] ?? 0) ^ (b[i % (b.length || 1)] ?? 0);
  return diff === 0;
}

/** Runs a rate-limiter binding; if the binding itself throws, the request is allowed (the limiter is a guard, not a dependency). */
export async function limitOrAllow(limiter: RateLimit, key: string): Promise<boolean> {
  try {
    return (await limiter.limit({ key })).success;
  } catch (err) {
    console.error('rate limiter failed, allowing request:', err instanceof Error ? err.message : String(err));
    return true;
  }
}

export const DEFAULT_CLAUDE_IP_DAILY = 40;

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Seconds until the next UTC midnight, when the daily counters roll over. */
export function secondsUntilUtcMidnight(now = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(60, Math.ceil((next - now.getTime()) / 1000));
}

/**
 * Counts one model-calling request against this visitor's daily allowance (CLAUDE_IP_DAILY, default 40 per UTC day) so one person cannot
 * use up the shared daily cap. The address is stored only as a short hash. Returns false when the allowance is used up. A request with
 * a valid DEMO_TOKEN header is not counted. If the counter cannot be read the request is allowed: the shared cap and spend checks in
 * lib/anthropic.ts still fail closed.
 */
export async function withinVisitorQuota(env: Env, ip: string, demoToken: string | undefined | null, now = new Date()): Promise<boolean> {
  if (safeEqual(demoToken, env.DEMO_TOKEN)) return true;
  const limit = Number(env.CLAUDE_IP_DAILY ?? DEFAULT_CLAUDE_IP_DAILY);
  if (!Number.isFinite(limit) || limit <= 0) return true;
  try {
    const key = `claude-ip:${now.toISOString().slice(0, 10)}:${await sha256Hex(ip)}`;
    const row = await env.DB.prepare(
      `INSERT INTO pulse_feed_state (source_key, last_note) VALUES (?1, '1')
       ON CONFLICT(source_key) DO UPDATE SET last_note = CAST(CAST(pulse_feed_state.last_note AS INTEGER) + 1 AS TEXT)
       RETURNING last_note`
    ).bind(key).first<{ last_note: string }>();
    return Number(row?.last_note ?? 0) <= limit;
  } catch {
    return true;
  }
}
