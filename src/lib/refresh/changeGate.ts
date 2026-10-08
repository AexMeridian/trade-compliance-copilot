import type { Env } from '../../types/env.js';

// The bulk reference jobs (SDN, CSL, UN, UK, HTS, Schedule B...) replace a whole
// table: DELETE everything, then INSERT everything. D1 bills a write for every
// row touched, including index and full-text-search entries, so one SDN reload
// costs far more than the free tier's 100,000 rows-written-per-day allowance
// can absorb twice. Most weeks the upstream file hasn't changed at all, so each
// job fingerprints what it downloaded and skips the rewrite when it matches the
// fingerprint of the last successful load.
//
// The fingerprint lives in pulse_feed_state (key `hash:<source>`, in last_note),
// which already exists and needs no migration. Callers must call commit() only
// after their write batch succeeded, so a failed load is retried, not skipped.

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const key = (source: string) => `hash:${source}`;

export async function storedFingerprint(env: Env, source: string): Promise<string | null> {
  const row = await env.DB.prepare('SELECT last_note FROM pulse_feed_state WHERE source_key = ?1').bind(key(source)).first<{ last_note: string | null }>();
  return row?.last_note ?? null;
}

export interface ChangeGate {
  unchanged: boolean;
  commit: () => Promise<void>;
}

export async function changeGate(env: Env, source: string, payload: string): Promise<ChangeGate> {
  const fingerprint = await sha256Hex(payload);
  const unchanged = (await storedFingerprint(env, source)) === fingerprint;
  return {
    unchanged,
    commit: async () => {
      await env.DB.prepare(
        `INSERT INTO pulse_feed_state (source_key, last_attempt_at, last_success_at, last_note) VALUES (?1, ?2, ?2, ?3)
         ON CONFLICT(source_key) DO UPDATE SET last_attempt_at = excluded.last_attempt_at,
           last_success_at = excluded.last_success_at, last_note = excluded.last_note`
      )
        .bind(key(source), new Date().toISOString(), fingerprint)
        .run();
    },
  };
}
