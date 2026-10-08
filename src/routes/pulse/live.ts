import { Hono } from 'hono';
import type { Env } from '../../types/env.js';
import type { PulseApp } from './util.js';

// Feeds the globe's live arcs: per-country action counts for the last 30 days plus the
// latest few actions for the busiest countries (so hovering an arc can say what is
// behind it). Two small reads, edge-cached for 5 minutes in src/index.ts, so any number
// of open tabs polling every 5 minutes costs about one database read per 5 minutes per
// data centre -- the same data /summary already derives, without its dozen queries.
const TOP_WITH_LATEST = 8;
const LATEST_PER_COUNTRY = 3;

interface Row {
  title: string;
  html_url: string;
  publication_date: string;
  tag: string;
  countries: string | null;
}

export const liveRoute: PulseApp = new Hono<{ Bindings: Env }>();

liveRoute.get('/live-arcs', async (c) => {
  const [counts, recent] = await Promise.all([
    c.env.DB.prepare(
      `SELECT je.value AS country, COUNT(*) AS n
       FROM trade_policy_actions, json_each(countries) je
       WHERE publication_date >= date('now', '-30 days') AND countries IS NOT NULL AND countries != '[]'
       GROUP BY country ORDER BY n DESC LIMIT 40`
    ).all<{ country: string; n: number }>(),
    c.env.DB.prepare(
      `SELECT title, html_url, publication_date, tag, countries FROM trade_policy_actions
       WHERE publication_date >= date('now', '-30 days') AND countries IS NOT NULL AND countries != '[]'
       ORDER BY publication_date DESC, document_number DESC LIMIT 300`
    ).all<Row>(),
  ]);

  const top = new Set(counts.results.slice(0, TOP_WITH_LATEST).map((r) => r.country));
  const latest = new Map<string, { title: string; url: string; date: string; tag: string }[]>();
  for (const row of recent.results) {
    let codes: string[] = [];
    try {
      codes = JSON.parse(row.countries ?? '[]') as string[];
    } catch {
      continue;
    }
    for (const code of codes) {
      if (!top.has(code)) continue;
      const list = latest.get(code) ?? [];
      if (list.length < LATEST_PER_COUNTRY) {
        list.push({ title: row.title, url: row.html_url, date: row.publication_date, tag: row.tag });
        latest.set(code, list);
      }
    }
  }

  c.header('Cache-Control', 'public, max-age=300');
  return c.json({
    asOf: new Date().toISOString(),
    countries: counts.results.map((r) => ({ country: r.country, count: r.n, latest: latest.get(r.country) ?? [] })),
  });
});
