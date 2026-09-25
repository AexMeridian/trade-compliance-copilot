// World-news refresh: fetch each feed in NEWS_FEEDS concurrently, keep only
// items published in the last NEWS_MAX_AGE_DAYS that pass tagNews's relevance
// rules, and upsert headline + link + short summary (never article text).
// One feed failing doesn't fail the run -- it's reported in the result note
// -- but every feed failing does.
import type { Env } from '../../types/env.js';
import { buildInsertStatements, sqlJson, sqlString } from '../refresh/sql.js';
import type { RefreshResult } from '../refresh/types.js';
import { parseRss } from './rss.js';
import { NEWS_FEEDS, tagNews } from './newsTag.js';

const UA = 'trade-compliance-copilot-research/1.0 (portfolio project data loader)';
const REQUEST_TIMEOUT_MS = 10_000;
const NEWS_MAX_AGE_DAYS = 14;
const NEWS_RETENTION_DAYS = 30;

async function sha1Hex(s: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(s));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export interface NewsRefreshResult extends RefreshResult {
  note: string;
}

export async function refreshNews(env: Env): Promise<NewsRefreshResult> {
  const cutoff = Date.now() - NEWS_MAX_AGE_DAYS * 86_400_000;

  const fetched = await Promise.all(
    NEWS_FEEDS.map(async (feed) => {
      try {
        const res = await fetch(feed.url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return { feed, items: parseRss(await res.text()), error: null as string | null };
      } catch (err) {
        return { feed, items: [], error: err instanceof Error ? err.message : String(err) };
      }
    })
  );

  const failed = fetched.filter((f) => f.error).map((f) => `${f.feed.key} (${f.error})`);
  if (failed.length === fetched.length) throw new Error(`All news feeds failed: ${failed.join(', ')}`);

  const now = new Date().toISOString();
  const seen = new Set<string>();
  const rows: string[] = [];
  let considered = 0;

  for (const { feed, items } of fetched) {
    for (const item of items) {
      if (Date.parse(item.publishedAt) < cutoff) continue;
      considered++;
      const tagged = tagNews(feed, item.title, item.summary);
      if (!tagged) continue;
      const id = await sha1Hex(item.link);
      if (seen.has(id)) continue; // same story surfaced by two feeds (e.g. BBC World and Politics)
      seen.add(id);
      rows.push(
        `(${sqlString(id)}, ${sqlString(item.title)}, ${sqlString(item.summary)}, ${sqlString(item.link)}, ${sqlString(feed.source)}, ` +
          `${sqlString(tagged.category)}, ${sqlJson(tagged.countries)}, ${sqlString(item.publishedAt)}, ${sqlString(now)}, ${sqlString(item.imageUrl)})`
      );
    }
  }

  const retentionEdge = new Date(Date.now() - NEWS_RETENTION_DAYS * 86_400_000).toISOString();
  await env.DB.batch([
    ...buildInsertStatements(
      'INSERT INTO world_news (id, title, summary, url, source, category, countries, published_at, fetched_at, image_url) VALUES',
      rows,
      100,
      `ON CONFLICT(id) DO UPDATE SET title = excluded.title, summary = excluded.summary, category = excluded.category,
         countries = excluded.countries, fetched_at = excluded.fetched_at, image_url = excluded.image_url`
    ).map((s) => env.DB.prepare(s)),
    env.DB.prepare('DELETE FROM world_news WHERE published_at < ?1').bind(retentionEdge),
  ]);

  const note =
    `Kept ${rows.length} of ${considered} recent items (the rest weren't trade-relevant).` +
    (failed.length ? ` Feeds unavailable: ${failed.join(', ')}.` : '');
  return { source: 'pulse_news', rows: rows.length, note };
}
