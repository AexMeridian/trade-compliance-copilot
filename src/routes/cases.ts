import { Hono } from 'hono';
import type { Env } from '../types/env.js';
import { createCase, deleteCase, getCaseFile, listSampleCases, CASE_RETENTION_DAYS } from '../lib/caseStore.js';
import type { Direction, Verdict } from '../types/case.js';

export const casesRoute = new Hono<{ Bindings: Env }>();

casesRoute.post('/', async (c) => {
  const body = await c.req.json<{ direction: Direction }>();
  if (body.direction !== 'import' && body.direction !== 'export') {
    return c.json({ error: 'direction must be "import" or "export"' }, 400);
  }
  const id = crypto.randomUUID();
  const { caseFile, deleteToken } = await createCase(c.env, body.direction, id);
  // The delete token is shown once, here; only its hash is stored.
  return c.json({ id, case_file: caseFile, delete_token: deleteToken, retention_days: CASE_RETENTION_DAYS });
});

// Deleting needs the secret token returned when the case was created.
casesRoute.delete('/:id', async (c) => {
  const token = c.req.header('X-Delete-Token') ?? '';
  const outcome = await deleteCase(c.env, c.req.param('id'), token);
  if (outcome === 'missing') return c.json({ error: 'Case not found' }, 404);
  if (outcome === 'forbidden') return c.json({ error: 'This case can only be deleted with its delete token.' }, 403);
  return c.json({ deleted: true });
});

casesRoute.get('/samples', async (c) => {
  const samples = await listSampleCases(c.env);
  return c.json({ samples });
});

casesRoute.get('/:id', async (c) => {
  const caseFile = await getCaseFile(c.env, c.req.param('id'));
  if (!caseFile) return c.json({ error: 'Case not found' }, 404);
  return c.json({ case_file: caseFile });
});

function computeVerdict(caseFile: NonNullable<Awaited<ReturnType<typeof getCaseFile>>>): Verdict {
  if (caseFile.determination.verdict) return caseFile.determination.verdict;
  if (caseFile.screening.hard_stop_triggered) return 'stop';
  return 'review_required';
}

casesRoute.get('/:id/report', async (c) => {
  const caseFile = await getCaseFile(c.env, c.req.param('id'));
  if (!caseFile) return c.json({ error: 'Case not found' }, 404);
  return c.json({
    case_file: caseFile,
    verdict: computeVerdict(caseFile),
    generated_at: new Date().toISOString(),
  });
});
