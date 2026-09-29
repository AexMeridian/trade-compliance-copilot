import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import type { Env } from './types/env.js';
import { casesRoute } from './routes/cases.js';
import { classificationRoute } from './routes/classification.js';
import { originRoute } from './routes/origin.js';
import { screeningRoute } from './routes/screening.js';
import { determinationRoute } from './routes/determination.js';
import { pulseRoute } from './routes/pulse.js';
import { scheduled } from './scheduled.js';

const app = new Hono<{ Bindings: Env }>();

// Baseline hardening headers on every API response (static pages get theirs
// from frontend/public/_headers). API responses are JSON/XML, never framed.
app.use('/api/*', secureHeaders({ crossOriginResourcePolicy: 'same-site', xFrameOptions: 'DENY', referrerPolicy: 'no-referrer' }));

// The Pulse read API is public and unauthenticated. Per-IP cap so one client
// can't run the site out of its Workers request quota or hammer D1; a real
// reader makes a handful of calls per visit, far under this.
app.use('/api/pulse/*', async (c, next) => {
  const key = c.req.header('cf-connecting-ip') ?? 'unknown';
  const { success } = await c.env.PULSE_RATE_LIMITER.limit({ key });
  if (!success) {
    c.header('Retry-After', '30');
    return c.json({ error: 'Too many requests. Please wait a moment and try again.' }, 429);
  }
  return next();
});

const CLAUDE_CALLING_SUFFIXES = ['/classification', '/origin', '/screening', '/determination'];

// This is a public demo Worker with no auth in front of it, and these 4
// routes are the only ones that call the Anthropic API -- without a limit
// here, a bot finding the URL could hammer them and run up unbounded Claude
// spend on the deploying account's key. Every other route (health check,
// case reads, samples) is a plain D1 read and stays unthrottled.
app.use('/api/cases/*', async (c, next) => {
  if (c.req.method === 'POST' && CLAUDE_CALLING_SUFFIXES.some((s) => c.req.path.endsWith(s))) {
    const key = c.req.header('cf-connecting-ip') ?? 'unknown';
    const { success } = await c.env.CLAUDE_RATE_LIMITER.limit({ key });
    if (!success) {
      return c.json({ error: 'Rate limit exceeded. Please wait a moment before trying again.' }, 429);
    }
  }
  return next();
});

app.route('/api/cases', casesRoute);
app.route('/api/cases', classificationRoute);
app.route('/api/cases', originRoute);
app.route('/api/cases', screeningRoute);
app.route('/api/cases', determinationRoute);
app.route('/api/pulse', pulseRoute);

app.get('/api/health', (c) => c.json({ ok: true }));

// Without this, an uncaught exception (a D1 outage, a quota day, anything
// unexpected) falls through to Hono's default handler: a bare "Internal
// Server Error" text response, which lib/api.ts's request() can't parse as
// JSON and therefore reports as a generic, unhelpful message everywhere it's
// surfaced. This keeps every route's error contract the same ({ error }, as
// json) and logs the real cause to the Worker's own log instead of the client.
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: 'Something went wrong on our end. Please try again shortly.' }, 500);
});

export default {
  fetch: app.fetch,
  scheduled,
};
