import { Hono } from 'hono';
import type { Env } from '../types/env.js';
import { createCase, getCaseFile, listSampleCases } from '../lib/caseStore.js';
import type { Direction, Verdict } from '../types/case.js';

export const casesRoute = new Hono<{ Bindings: Env }>();

casesRoute.post('/', async (c) => {
  const body = await c.req.json<{ direction: Direction }>();
  if (body.direction !== 'import' && body.direction !== 'export') {
    return c.json({ error: 'direction must be "import" or "export"' }, 400);
  }
  const id = crypto.randomUUID();
  const caseFile = await createCase(c.env, body.direction, id);
  return c.json({ id, case_file: caseFile });
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
