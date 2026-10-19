import { Hono } from 'hono';
import type { Env } from '../../types/env.js';
import type { PulseApp } from './util.js';
import { AFRO_SOURCE, citationFor, OPINION_SURVEYS, PEW_DISCLAIMER, QUESTION } from '../../lib/power/opinion.js';
import { AFRO_MEDIAN_POSITIVE, AFRO_ROUND10 } from '../../lib/power/afrobarometer.generated.js';

// Published opinion readings (see lib/power/opinion.ts). Static data bundled with the Worker: no database read, so it costs
// nothing against the free quota, and a browser may keep it for a day.
export const opinionRoute: PulseApp = new Hono<{ Bindings: Env }>();

opinionRoute.get('/opinion', (c) => {
  c.header('Cache-Control', 'public, max-age=86400');
  return c.json({
    question: QUESTION,
    disclaimer: PEW_DISCLAIMER,
    surveys: OPINION_SURVEYS.map((s) => ({ ...s, citation: citationFor(s) })),
    africa: { ...AFRO_SOURCE, medianPositive: AFRO_MEDIAN_POSITIVE, countries: AFRO_ROUND10 },
  });
});
