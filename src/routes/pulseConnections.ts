import { Hono } from 'hono';
import type { Env } from '../types/env.js';
import type { PulseAction } from '../lib/pulse/types.js';
import { topicsFor, topicHintForActionTag, TOPICS, type Topic } from '../lib/pulse/topic.js';
import { findRelated, marketReaction, type ConnEvent, type EventKind, type MarketReaction, type SeriesPoint } from '../lib/pulse/links.js';
import { CURRENCY_FOR, MARKET_TILE_FOR, TOPIC_COMMODITY } from '../lib/pulse/countryMarkets.js';

// Cross-domain connections. Everything here is derived from rows that already
// exist (actions, news, trade barriers, forced-labor findings, market series)
// by the deterministic rules in lib/pulse/links.ts -- no LLM, no stored links.
export const connectionsRoute = new Hono<{ Bindings: Env }>();

function clampInt(raw: string | undefined, def: number, min: number, max: number): number {
  const n = raw === undefined || raw === '' ? NaN : Number(raw);
  return Math.min(Math.max(Number.isFinite(n) ? n : def, min), max);
}

function parseCodes(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** ISO day (YYYY-MM-DD) from either an ISO timestamp or CBP's "M/D/YYYY" form. */
const isoDay = (s: string) => {
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (us) return `${us[3]}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`;
  return s.slice(0, 10);
};

interface NewsRow { id: string; title: string; summary: string | null; url: string; source: string; countries: string | null; published_at: string }
interface WroRow { id: number; effective_date: string; merchandise: string; order_type: string; status: string; entity: string | null }
interface GtaRow { intervention_id: number; state_act_title: string; intervention_url: string | null; date_announced: string; gta_evaluation: string }

function actionEvent(a: PulseAction): ConnEvent {
  return {
    kind: 'action', id: a.document_number, date: isoDay(a.publication_date), title: a.title, url: a.html_url, source: a.agency,
    countries: parseCodes(a.countries), topics: topicsFor(`${a.title} ${a.abstract ?? ''}`, topicHintForActionTag(a.tag)),
  };
}
function newsEvent(n: NewsRow): ConnEvent {
  return { kind: 'news', id: n.id, date: isoDay(n.published_at), title: n.title, url: n.url, source: n.source, countries: parseCodes(n.countries), topics: topicsFor(`${n.title} ${n.summary ?? ''}`) };
}

async function loadCountryEvents(env: Env, code: string, name: string | null, days: number): Promise<ConnEvent[]> {
  const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const [actions, news, wro, gta] = await Promise.all([
    env.DB.prepare(`SELECT * FROM trade_policy_actions WHERE countries LIKE '%"' || ?1 || '"%' AND publication_date >= ?2 ORDER BY publication_date DESC LIMIT 120`)
      .bind(code, since).all<PulseAction>().catch(() => ({ results: [] as PulseAction[] })),
    env.DB.prepare(`SELECT id, title, summary, url, source, countries, published_at FROM world_news WHERE countries LIKE '%"' || ?1 || '"%' AND published_at >= ?2 ORDER BY published_at DESC LIMIT 80`)
      .bind(code, since).all<NewsRow>().catch(() => ({ results: [] as NewsRow[] })),
    // effective_date is stored as CBP's "M/D/YYYY" text, which neither sorts nor
    // range-filters correctly in SQL -- fetch the country's rows (a few dozen at
    // most) and filter by the normalized date below.
    env.DB.prepare(`SELECT id, effective_date, merchandise, order_type, status, entity FROM wro_findings WHERE country_code = ?1 LIMIT 400`)
      .bind(code).all<WroRow>().catch(() => ({ results: [] as WroRow[] })),
    name
      ? env.DB.prepare(
          `SELECT intervention_id, state_act_title, intervention_url, date_announced, gta_evaluation FROM gta_interventions
           WHERE date_announced >= ?2 AND EXISTS (SELECT 1 FROM json_each(implementing_jurisdictions) je WHERE json_extract(je.value, '$.name') = ?1)
           ORDER BY date_announced DESC LIMIT 30`
        ).bind(name, since).all<GtaRow>().catch(() => ({ results: [] as GtaRow[] }))
      : Promise.resolve({ results: [] as GtaRow[] }),
  ]);

  const events: ConnEvent[] = [
    ...actions.results.map(actionEvent),
    ...news.results.map(newsEvent),
    ...wro.results.filter((w) => isoDay(w.effective_date) >= since).map((w): ConnEvent => ({
      kind: 'wro', id: String(w.id), date: isoDay(w.effective_date), title: `CBP forced-labor ${w.order_type.toLowerCase()}: ${w.merchandise}${w.entity ? ` (${w.entity})` : ''}`,
      url: 'https://www.cbp.gov/trade/forced-labor/withhold-release-orders-and-findings', source: 'U.S. Customs and Border Protection', countries: [code],
      topics: topicsFor(`${w.merchandise} forced labor`, ['Supply chain & shipping']),
    })),
    ...gta.results.map((g): ConnEvent => ({
      kind: 'gta', id: String(g.intervention_id), date: isoDay(g.date_announced), title: g.state_act_title, url: g.intervention_url, source: 'Global Trade Alert',
      countries: [code], topics: topicsFor(g.state_act_title, ['Tariffs']),
    })),
  ];
  return events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

async function loadSeries(env: Env, seriesId: string, from: string): Promise<SeriesPoint[]> {
  const { results } = await env.DB.prepare(`SELECT obs_date, value FROM market_series WHERE series_id = ?1 AND obs_date >= ?2 ORDER BY obs_date`)
    .bind(seriesId, from).all<SeriesPoint>().catch(() => ({ results: [] as SeriesPoint[] }));
  return results;
}

export interface EventReaction extends MarketReaction {
  seriesId: string;
  label: string;
  /** What the movement means, in plain words. */
  reading: string;
}

const INDEX_LABELS: Record<string, string> = {
  'CL=F': 'Crude oil', 'HG=F': 'Copper', '^N225': 'Nikkei 225', '^GDAXI': 'DAX', '^FTSE': 'FTSE 100', '000001.SS': 'Shanghai Composite',
  '^HSI': 'Hang Seng', TSM: 'TSMC', '^KS11': 'KOSPI', '^NSEI': 'NIFTY 50', '^BVSP': 'Bovespa',
};

function describe(seriesId: string, changePct: number): { label: string; reading: string } {
  const abs = Math.abs(changePct).toFixed(1);
  const flat = Math.abs(changePct) < 0.1;
  if (seriesId.startsWith('FX:')) {
    const cur = seriesId.slice(3);
    // Series is "units of currency per 1 USD": up means the currency bought less.
    return { label: `USD/${cur}`, reading: flat ? `${cur} little changed against the dollar` : `${cur} ${changePct > 0 ? 'weakened' : 'strengthened'} ${abs}% against the dollar` };
  }
  const label = INDEX_LABELS[seriesId] ?? seriesId;
  return { label, reading: flat ? `${label} little changed` : `${label} ${changePct > 0 ? 'rose' : 'fell'} ${abs}%` };
}

/** Series whose movement is worth showing against an event: the country's own currency and index, and the commodity its topics point to. */
function seriesFor(code: string, topics: Topic[]): string[] {
  const ids: string[] = [];
  if (CURRENCY_FOR[code]) ids.push(`FX:${CURRENCY_FOR[code]}`);
  if (MARKET_TILE_FOR[code]) ids.push(MARKET_TILE_FOR[code]);
  for (const t of topics) if (TOPIC_COMMODITY[t]) ids.push(TOPIC_COMMODITY[t]);
  return [...new Set(ids)];
}

const PER_KIND_CAP: Record<EventKind, number> = { action: 12, news: 20, gta: 10, wro: 8 };

const REACTION_NOTE = 'Shown for context only: a market moved after an event does not mean the event caused it.';

// Country timeline: every linked source for one country in one merged,
// dated list, with topic counts and (where the data covers it) how markets
// moved over the five days after each event.
connectionsRoute.get('/connections', async (c) => {
  const code = (c.req.query('country') ?? '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return c.json({ error: 'country must be a 2-letter code' }, 400);
  const name = c.req.query('name') || null;
  const days = clampInt(c.req.query('days'), 60, 7, 180);
  const topic = c.req.query('topic');
  const wanted = (TOPICS as readonly string[]).includes(topic ?? '') ? (topic as Topic) : null;

  const all = await loadCountryEvents(c.env, code, name, days);
  const topicCounts = TOPICS.map((t) => ({ topic: t, count: all.filter((e) => e.topics.includes(t)).length })).filter((t) => t.count > 0).sort((a, b) => b.count - a.count);
  // Per-source caps keep a high-volume source (routine antidumping notices for
  // China run to dozens a month) from burying news and trade barriers. Newest
  // first within each source; the response says how many were left out.
  const filtered = wanted ? all.filter((e) => e.topics.includes(wanted)) : all;
  const taken: Record<string, number> = {};
  const omitted: Record<string, number> = {};
  const events = filtered.filter((e) => {
    taken[e.kind] = (taken[e.kind] ?? 0) + 1;
    if (taken[e.kind] > PER_KIND_CAP[e.kind]) {
      omitted[e.kind] = (omitted[e.kind] ?? 0) + 1;
      return false;
    }
    return true;
  });

  const from = new Date(Date.now() - (days + 10) * 86_400_000).toISOString().slice(0, 10);
  const neededIds = [...new Set(events.slice(0, 25).flatMap((e) => seriesFor(code, e.topics)))];
  const seriesMap = new Map<string, SeriesPoint[]>();
  await Promise.all(neededIds.map(async (id) => seriesMap.set(id, await loadSeries(c.env, id, from))));

  const out = events.map((e, i) => {
    const reactions: EventReaction[] = [];
    if (i < 25 && e.kind !== 'news') {
      for (const id of seriesFor(code, e.topics)) {
        const r = marketReaction(seriesMap.get(id) ?? [], e.date);
        if (r) reactions.push({ ...r, seriesId: id, ...describe(id, r.changePct) });
      }
    }
    return { ...e, reactions };
  });

  return c.json({ country: code, days, topic: wanted, events: out, topicCounts, omitted, reactionNote: REACTION_NOTE });
});

// Items related to one item, by the rule in lib/pulse/links.ts.
connectionsRoute.get('/related', async (c) => {
  const kind = c.req.query('kind') as EventKind | undefined;
  const id = c.req.query('id');
  if (!id || (kind !== 'action' && kind !== 'news')) return c.json({ error: 'kind must be action or news, and id is required' }, 400);
  const names = (c.req.query('names') ?? '').split('|').filter(Boolean); // optional "CN:China|MX:Mexico"
  const nameMap = new Map(names.map((p) => p.split(':') as [string, string]));
  const nameOf = (code: string) => nameMap.get(code) ?? code;

  let subject: ConnEvent | null = null;
  if (kind === 'action') {
    const row = await c.env.DB.prepare('SELECT * FROM trade_policy_actions WHERE document_number = ?1').bind(id).first<PulseAction>();
    if (row) subject = actionEvent(row);
  } else {
    const row = await c.env.DB.prepare('SELECT id, title, summary, url, source, countries, published_at FROM world_news WHERE id = ?1').bind(id).first<NewsRow>();
    if (row) subject = newsEvent(row);
  }
  if (!subject) return c.json({ error: 'not found' }, 404);

  const windowDays = clampInt(c.req.query('days'), 14, 1, 60);
  const links: ReturnType<typeof findRelated> = [];
  for (const code of subject.countries.slice(0, 3)) {
    const events = await loadCountryEvents(c.env, code, nameMap.get(code) ?? null, windowDays + 30);
    links.push(...findRelated(subject, events, { windowDays, limit: 8, nameOf }));
  }
  const seen = new Set<string>();
  const unique = links
    .sort((a, b) => b.score - a.score)
    .filter((l) => {
      const key = `${l.event.kind}:${l.event.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);

  return c.json({ subject: { kind: subject.kind, id: subject.id, topics: subject.topics, countries: subject.countries }, windowDays, links: unique });
});
