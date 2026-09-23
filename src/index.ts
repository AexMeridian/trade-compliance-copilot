import { Hono } from 'hono';
import type { Env } from './types/env.js';
import { casesRoute } from './routes/cases.js';
import { classificationRoute } from './routes/classification.js';
import { originRoute } from './routes/origin.js';
import { screeningRoute } from './routes/screening.js';
import { determinationRoute } from './routes/determination.js';

const app = new Hono<{ Bindings: Env }>();

app.route('/api/cases', casesRoute);
app.route('/api/cases', classificationRoute);
app.route('/api/cases', originRoute);
app.route('/api/cases', screeningRoute);
app.route('/api/cases', determinationRoute);

app.get('/api/health', (c) => c.json({ ok: true }));

export default app;
