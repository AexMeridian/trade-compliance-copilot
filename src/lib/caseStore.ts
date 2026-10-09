import type { Env } from '../types/env.js';
import type { CaseFile, Direction, ModuleStatus } from '../types/case.js';
import { emptyCaseFile } from '../types/case.js';

// Read-whole / write-whole persistence over `cases.case_file` (a single JSON
// blob). Safe here because this app has no concurrent multi-user editing of a
// single case -- a portfolio wizard flow, not a shared document. See the build
// plan's CaseFile persistence section.

interface CaseRow {
  id: string;
  direction: Direction;
  status: ModuleStatus | 'complete' | 'draft';
  case_file: string;
  created_at: string;
  updated_at: string;
  is_sample: number;
  sample_key: string | null;
}

// How long a user-created case is kept. Seeded samples are exempt.
export const CASE_RETENTION_DAYS = 30;

async function sha256Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Creates a case that expires in CASE_RETENTION_DAYS, and returns the one-time delete token. */
export async function createCase(env: Env, direction: Direction, id: string): Promise<{ caseFile: CaseFile; deleteToken: string }> {
  const caseFile = emptyCaseFile(id, direction);
  const deleteToken = [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const expiresAt = new Date(Date.parse(caseFile.created_at) + CASE_RETENTION_DAYS * 86_400_000).toISOString();
  await env.DB.prepare(
    `INSERT INTO cases (id, direction, status, case_file, created_at, updated_at, is_sample, sample_key, expires_at, delete_token_hash)
     VALUES (?1, ?2, 'draft', ?3, ?4, ?4, 0, NULL, ?5, ?6)`
  )
    .bind(id, direction, JSON.stringify(caseFile), caseFile.created_at, expiresAt, await sha256Hex(deleteToken))
    .run();
  return { caseFile, deleteToken };
}

export async function getCaseFile(env: Env, id: string): Promise<CaseFile | null> {
  const row = await env.DB.prepare(`SELECT * FROM cases WHERE id = ?1`).bind(id).first<CaseRow & { expires_at: string | null }>();
  if (!row) return null;
  // An expired case is treated as gone even before the daily purge removes the row.
  if (!row.is_sample && row.expires_at && row.expires_at < new Date().toISOString()) return null;
  return JSON.parse(row.case_file) as CaseFile;
}

/** Deletes a case and its audit events if (and only if) the token matches. */
export async function deleteCase(env: Env, id: string, token: string): Promise<'deleted' | 'forbidden' | 'missing'> {
  const row = await env.DB.prepare(`SELECT delete_token_hash, is_sample FROM cases WHERE id = ?1`).bind(id).first<{ delete_token_hash: string | null; is_sample: number }>();
  if (!row) return 'missing';
  if (row.is_sample || !row.delete_token_hash) return 'forbidden';
  const given = await sha256Hex(token);
  // Compare full-length hex digests without early exit.
  let diff = given.length ^ row.delete_token_hash.length;
  for (let i = 0; i < Math.max(given.length, row.delete_token_hash.length); i++) diff |= (given.charCodeAt(i) || 0) ^ (row.delete_token_hash.charCodeAt(i) || 0);
  if (diff !== 0) return 'forbidden';
  await env.DB.batch([env.DB.prepare(`DELETE FROM case_events WHERE case_id = ?1`).bind(id), env.DB.prepare(`DELETE FROM cases WHERE id = ?1`).bind(id)]);
  return 'deleted';
}

/** Removes expired, non-sample cases (and their events) in a small batch; returns how many cases went. */
export async function purgeExpiredCases(env: Env, limit = 100): Promise<number> {
  const now = new Date().toISOString();
  const { results } = await env.DB.prepare(`SELECT id FROM cases WHERE is_sample = 0 AND expires_at IS NOT NULL AND expires_at < ?1 LIMIT ?2`)
    .bind(now, limit)
    .all<{ id: string }>();
  if (results.length === 0) return 0;
  await env.DB.batch(results.flatMap((r) => [env.DB.prepare(`DELETE FROM case_events WHERE case_id = ?1`).bind(r.id), env.DB.prepare(`DELETE FROM cases WHERE id = ?1`).bind(r.id)]));
  return results.length;
}

export async function saveCaseFile(env: Env, caseFile: CaseFile): Promise<void> {
  caseFile.updated_at = new Date().toISOString();
  const status = overallStatus(caseFile);
  await env.DB.prepare(`UPDATE cases SET case_file = ?1, status = ?2, updated_at = ?3 WHERE id = ?4`)
    .bind(JSON.stringify(caseFile), status, caseFile.updated_at, caseFile.id)
    .run();
}

function overallStatus(caseFile: CaseFile): string {
  if (caseFile.determination.status === 'complete') return 'complete';
  if (caseFile.screening.status === 'complete') return 'module3_done';
  if (caseFile.origin.status === 'complete') return 'module2_done';
  if (caseFile.classification.status === 'complete') return 'module1_done';
  return 'draft';
}

export async function logCaseEvent(
  env: Env,
  caseId: string,
  module: string,
  eventType: string,
  payload: unknown
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO case_events (case_id, module, event_type, payload, created_at) VALUES (?1, ?2, ?3, ?4, ?5)`
  )
    .bind(caseId, module, eventType, JSON.stringify(payload), new Date().toISOString())
    .run();
}

export interface SampleCaseRow {
  id: string;
  direction: Direction;
  sample_key: string;
  case_file: string;
}

export async function listSampleCases(env: Env): Promise<{ id: string; direction: Direction; sample_key: string; product_description: string }[]> {
  const { results } = await env.DB.prepare(
    `SELECT id, direction, sample_key, case_file FROM cases WHERE is_sample = 1 ORDER BY sample_key`
  ).all<SampleCaseRow>();
  return results.map((r) => {
    const cf = JSON.parse(r.case_file) as CaseFile;
    return {
      id: r.id,
      direction: r.direction,
      sample_key: r.sample_key,
      product_description: cf.classification.product_description,
    };
  });
}
