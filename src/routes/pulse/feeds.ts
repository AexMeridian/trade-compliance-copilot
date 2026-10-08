import { Hono } from 'hono';
import type { MiddlewareHandler } from 'hono';
import type { Env } from '../../types/env.js';
import type { PulseApp } from './util.js';
import {
  buildAtom,
  buildJsonFeed,
  buildRss,
  escapeLike,
  feedTitle,
  lastModified,
  normalizeFilters,
  weakEtag,
  type FeedItem,
  type FeedMeta,
} from '../../lib/feed.js';

// Public syndication feeds. Read-only: no database writes, no per-reader identifiers,
// nothing fetched from third parties. Content and legal rules live in lib/feed.ts.
// Edge caching and conditional GET are wired up in src/index.ts (FEED_PATHS).

const DESCRIPTION = 'New U.S. tariff, sanctions, export-control and trade-agreement actions from the Federal Register.';

interface Row {
  document_number: string;
  title: string;
  abstract: string | null;
  agency: string;
  doc_type: string;
  tag: string;
  publication_date: string;
  html_url: string;
  fetched_at: string;
}

const FORMATS = {
  rss: { type: 'application/rss+xml; charset=utf-8', build: buildRss },
  atom: { type: 'application/atom+xml; charset=utf-8', build: buildAtom },
  'feed.json': { type: 'application/feed+json; charset=utf-8', build: buildJsonFeed },
} as const;

export const FEED_PATHS = Object.keys(FORMATS);

// A feed opened directly in a browser must never be able to run script or load anything.
const FEED_CSP = "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; sandbox";

function plain(c: { text: (t: string, s: 400) => Response }, message: string) {
  return c.text(message, 400);
}

export const feedsRoute: PulseApp = new Hono<{ Bindings: Env }>();

for (const [path, format] of Object.entries(FORMATS)) {
  feedsRoute.get(`/${path}`, async (c) => {
    const url = new URL(c.req.url);
    const parsed = normalizeFilters((name) => url.searchParams.get(name));
    if (!parsed.ok) return plain(c, parsed.error);
    const { filters, canonical } = parsed;

    // LIKE wildcards are escaped so a keyword matches literally; without this a
    // client could send "%" or "_" to force a match-everything scan.
    const keywords = filters.keywords.map(escapeLike);
    const { results } = await c.env.DB.prepare(
      `SELECT document_number, title, abstract, agency, doc_type, tag, publication_date, html_url, fetched_at
       FROM trade_policy_actions
       WHERE (?1 = '[]' OR EXISTS (SELECT 1 FROM json_each(?1) je WHERE tag = je.value))
         AND (?2 = '[]' OR EXISTS (SELECT 1 FROM json_each(?2) je
              WHERE title LIKE '%' || je.value || '%' ESCAPE '\\' OR abstract LIKE '%' || je.value || '%' ESCAPE '\\'))
         AND (?3 = '[]' OR EXISTS (SELECT 1 FROM json_each(?3) je WHERE countries LIKE '%"' || je.value || '"%'))
       ORDER BY publication_date DESC, document_number DESC LIMIT ?4`
    )
      .bind(JSON.stringify(filters.tags), JSON.stringify(keywords), JSON.stringify(filters.countries), filters.limit)
      .all<Row>();

    const items: FeedItem[] = results.map((r) => ({
      id: r.document_number,
      title: r.title,
      url: r.html_url,
      published: r.publication_date,
      ingested: r.fetched_at,
      tag: r.tag,
      agency: r.agency,
      docType: r.doc_type,
      abstract: r.abstract,
    }));

    const origin = url.origin;
    const meta: FeedMeta = {
      title: feedTitle(filters),
      description: DESCRIPTION,
      homeUrl: `${origin}/`,
      // Rebuilt from validated parts, never echoed from the request, so a crafted URL
      // cannot inject anything into the feed's own link.
      selfUrl: `${origin}/api/pulse/${path}${canonical ? `?${canonical}` : ''}`,
      siteName: 'Aex Terminal',
      generated: new Date().toISOString(),
    };

    const body = format.build(items, meta);
    return new Response(body, {
      headers: {
        'Content-Type': format.type,
        ETag: await weakEtag(body),
        'Last-Modified': lastModified(items, meta.generated).toUTCString(),
        'Cache-Control': 'public, max-age=600, stale-while-revalidate=3600',
        'Content-Security-Policy': FEED_CSP,
        // Read-only public data: lets browser-based feed readers fetch it.
        'Access-Control-Allow-Origin': '*',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
}

/**
 * Turns a full 200 into a bodiless 304 when the reader already has the current copy.
 * Registered outside the edge cache (src/index.ts) so it also applies to cached
 * responses -- a polling reader then costs one tiny response, not the whole feed.
 */
export const conditionalGet: MiddlewareHandler = async (c, next) => {
  await next();
  const res = c.res;
  if (res.status !== 200 || (c.req.method !== 'GET' && c.req.method !== 'HEAD')) return;
  const etag = res.headers.get('ETag');
  const lastMod = res.headers.get('Last-Modified');
  const inm = c.req.header('If-None-Match');
  const ims = c.req.header('If-Modified-Since');

  let fresh = false;
  if (inm) {
    const weak = (v: string) => v.trim().replace(/^W\//, '');
    fresh = !!etag && inm.split(',').some((v) => v.trim() === '*' || weak(v) === weak(etag));
  } else if (ims && lastMod) {
    const since = Date.parse(ims);
    fresh = Number.isFinite(since) && Date.parse(lastMod) <= since;
  }
  if (!fresh) return;

  const headers = new Headers(res.headers);
  headers.delete('Content-Type');
  headers.delete('Content-Length');
  c.res = new Response(null, { status: 304, headers });
};
