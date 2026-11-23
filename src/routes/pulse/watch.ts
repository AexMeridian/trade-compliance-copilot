import { Hono } from 'hono';
import type { Env } from '../../types/env.js';
import type { PulseApp } from './util.js';
import { CSMS_FEED_URL, CSMS_PAGE_URL, CSMS_PROGRAMS, loadCsms, refreshCsms } from '../../lib/pulse/csms.js';
import { refreshIfStale } from '../../lib/pulse/refreshLazy.js';
import { LIST_META, buildChangesRss, isChangeDate, summarize, type ChangesFile } from '../../lib/listChanges.js';
import changesData from '../../../data/lists/changes.json';

// Official-source watch endpoints: CBP CSMS bulletins tagged by program, and per-day changes to the sanctions and screening lists.
// Neither calls a model. CSMS reads one stored row (refreshed from CBP's GovDelivery feed); list changes are a file committed by the
// daily list sync (data/lists/changes.json), served from the Worker bundle because the Worker cannot read git.
export const watchRoute: PulseApp = new Hono<{ Bindings: Env }>();

const changes = changesData as ChangesFile;

watchRoute.get('/csms', async (c) => {
  try {
    c.executionCtx.waitUntil(Promise.allSettled([refreshIfStale(c.env, 'csms', 6 * 3_600_000, () => refreshCsms(c.env))]));
  } catch {
    /* no execution context (tests) */
  }
  const { asOf, items } = await loadCsms(c.env);
  c.header('Cache-Control', 'public, max-age=900');
  return c.json({
    asOf,
    latest: items[0]?.published ?? null,
    source: 'U.S. Customs and Border Protection, Cargo Systems Messaging Service (CSMS)',
    sourceUrl: CSMS_PAGE_URL,
    feedUrl: CSMS_FEED_URL,
    programs: CSMS_PROGRAMS,
    note: 'Programs are tagged from the message title only; a message that does not name a program in its title is left untagged. Open the message for the full text.',
    items: items.slice(0, 100),
  });
});

watchRoute.get('/list-changes', (c) => {
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({
    generatedAt: changes.generatedAt || null,
    source: 'Derived by comparing the official OFAC, Consolidated Screening List, UN and UK files each day (scripts/sync-lists.ts)',
    lists: LIST_META,
    days: summarize(changes, 90),
  });
});

watchRoute.get('/list-changes/:date', (c) => {
  const date = c.req.param('date');
  const day = isChangeDate(date) ? changes.days[date] : undefined;
  if (!day) return c.json({ error: 'No list changes recorded for that date.' }, 404);
  c.header('Cache-Control', 'public, max-age=3600');
  return c.json({ date, generatedAt: changes.generatedAt || null, lists: LIST_META, day });
});

/** RSS feed of the daily changes (served at /changes.xml). */
export function changesRss(origin: string): Response {
  return new Response(buildChangesRss(changes, origin), {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox",
      'Access-Control-Allow-Origin': '*',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
