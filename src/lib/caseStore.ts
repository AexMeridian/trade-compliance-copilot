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

export async function createCase(env: Env, direction: Direction, id: string): Promise<CaseFile> {
  const caseFile = emptyCaseFile(id, direction);
  await env.DB.prepare(
    `INSERT INTO cases (id, direction, status, case_file, created_at, updated_at, is_sample, sample_key)
     VALUES (?1, ?2, 'draft', ?3, ?4, ?4, 0, NULL)`
  )
    .bind(id, direction, JSON.stringify(caseFile), caseFile.created_at)
    .run();
  return caseFile;
}

export async function getCaseFile(env: Env, id: string): Promise<CaseFile | null> {
  const row = await env.DB.prepare(`SELECT * FROM cases WHERE id = ?1`).bind(id).first<CaseRow>();
  if (!row) return null;
  return JSON.parse(row.case_file) as CaseFile;
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
