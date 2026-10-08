// Public syndication feeds (RSS 2.0, Atom 1.0, JSON Feed 1.1) of U.S. trade actions.
//
// Everything here is pure -- no database, no network -- so the escaping, input
// validation and serialisation rules are unit-tested (tests/feed.test.ts) rather
// than only exercised through the route. The route is src/routes/pulse/feeds.ts.
//
// Content rules, deliberately conservative because a feed is republication:
//   * U.S. government sources only (Federal Register text is a public-domain U.S.
//     government work). Third-party news is not redistributed.
//   * Plain text only: no HTML, no images or enclosures, no tracking links.
//   * Every item links to the official Federal Register page, never to a copy.

export const FEED_TAGS = ['Tariff', 'Sanctions', 'Export Control', 'Trade Agreement', 'Other'] as const;

export const DEFAULT_LIMIT = 30;
export const MAX_LIMIT = 50;
const MAX_VALUES = 10; // per filter -- each extra value adds an OR branch to a LIKE scan
const MAX_VALUE_LENGTH = 50;

export interface FeedFilters {
  tags: string[];
  countries: string[];
  keywords: string[];
  limit: number;
}

export type FilterResult = { ok: true; filters: FeedFilters; canonical: string } | { ok: false; error: string };

// XML 1.0 forbids most control characters outright (even escaped), so a single stray
// one in an upstream abstract makes strict readers reject the entire feed. Also drops
// lone surrogates, which are not valid in UTF-8 output. Built from code points rather
// than a literal so no invisible characters sit in this source file.
const ILLEGAL_XML = new RegExp(
  '[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\uFFFE\\uFFFF]|[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])|(?<![\\uD800-\\uDBFF])[\\uDC00-\\uDFFF]',
  'g'
);

/** Text safe to place in an XML element or attribute value. */
export function xmlText(value: unknown): string {
  return String(value ?? '')
    .replace(ILLEGAL_XML, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Same stripping for JSON output, where control characters are legal but useless. */
function plainText(value: unknown): string {
  return String(value ?? '').replace(ILLEGAL_XML, '');
}

/** Escapes LIKE wildcards so a keyword is matched literally (pair with `ESCAPE '\'`). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function list(raw: string | null | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Validates and canonicalises feed query parameters. Unknown parameters are dropped,
 * lists are capped, and the result is sorted so the same request always produces the
 * same string -- used as the edge-cache key and the feed's own `self` link, which
 * stops a client from minting unlimited cache entries with junk parameters.
 */
export function normalizeFilters(get: (name: string) => string | null | undefined): FilterResult {
  const tagByLower = new Map(FEED_TAGS.map((t) => [t.toLowerCase(), t]));
  const tags: string[] = [];
  for (const raw of list(get('tag'))) {
    const tag = tagByLower.get(raw.toLowerCase());
    if (!tag) return { ok: false, error: `Unknown tag. Use any of: ${FEED_TAGS.join(', ')}.` };
    if (!tags.includes(tag)) tags.push(tag);
  }

  const countries: string[] = [];
  for (const raw of list(get('country'))) {
    const code = raw.toUpperCase();
    if (!/^[A-Z]{2}$/.test(code)) return { ok: false, error: 'Countries are two-letter codes, e.g. CN,MX.' };
    if (!countries.includes(code)) countries.push(code);
  }

  const keywords: string[] = [];
  for (const raw of list(get('q'))) {
    const word = plainText(raw).trim();
    if (word.length < 2) return { ok: false, error: 'Keywords must be at least 2 characters.' };
    if (word.length > MAX_VALUE_LENGTH) return { ok: false, error: `Keywords can be at most ${MAX_VALUE_LENGTH} characters.` };
    if (!keywords.includes(word)) keywords.push(word);
  }

  for (const [name, values] of [['tag', tags], ['country', countries], ['q', keywords]] as const) {
    if (values.length > MAX_VALUES) return { ok: false, error: `At most ${MAX_VALUES} values are allowed for "${name}".` };
  }

  const rawLimit = get('limit');
  const parsed = rawLimit === null || rawLimit === undefined || rawLimit === '' ? NaN : Number(rawLimit);
  const limit = Number.isFinite(parsed) ? Math.min(Math.max(Math.trunc(parsed), 1), MAX_LIMIT) : DEFAULT_LIMIT;

  tags.sort();
  countries.sort();
  keywords.sort();

  const canonical = new URLSearchParams();
  if (countries.length) canonical.set('country', countries.join(','));
  if (limit !== DEFAULT_LIMIT) canonical.set('limit', String(limit));
  if (keywords.length) canonical.set('q', keywords.join(','));
  if (tags.length) canonical.set('tag', tags.join(','));

  return { ok: true, filters: { tags, countries, keywords, limit }, canonical: canonical.toString() };
}

export interface FeedItem {
  id: string; // Federal Register document number -- stable, so readers never show duplicates
  title: string;
  url: string; // official federalregister.gov page
  published: string; // YYYY-MM-DD, the only date the source gives
  ingested: string; // ISO timestamp the row was first stored
  tag: string;
  agency: string;
  docType: string;
  abstract: string | null;
}

export interface FeedMeta {
  title: string;
  description: string;
  homeUrl: string; // site origin + '/'
  selfUrl: string; // canonical URL of this feed
  siteName: string;
  generated: string; // ISO timestamp, used for the channel's lastBuildDate when there are no items
}

export const FEED_NOTICE =
  'Source: Federal Register (federalregister.gov), a U.S. government publication in the public domain. Informational only, not legal advice; check the official notice before relying on it.';

/** First two agencies, since the Federal Register lists co-issuers in one string. */
function agencies(agency: string): string {
  return agency.split(', ').slice(0, 2).join(', ');
}

/** Trims on a word boundary so a summary never ends mid-word. */
export function summarize(text: string | null, max = 300): string {
  const clean = plainText(text).replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function itemDescription(item: FeedItem): string {
  const lead = `${item.docType} (${item.tag}) from ${agencies(item.agency)}.`;
  const body = summarize(item.abstract);
  return body ? `${lead} ${body}` : lead;
}

// The Federal Register publishes a date, not a time. Noon UTC keeps that date the
// same in every time zone a reader might render it in.
const publishedAt = (item: FeedItem) => new Date(`${item.published}T12:00:00Z`);
const validDate = (d: Date) => !Number.isNaN(d.getTime());

/** Newest item timestamp (or `fallback`), used for Last-Modified / lastBuildDate / updated. */
export function lastModified(items: FeedItem[], fallback: string): Date {
  let newest = 0;
  for (const item of items) {
    const t = Date.parse(item.ingested);
    if (Number.isFinite(t) && t > newest) newest = t;
    const p = publishedAt(item).getTime();
    if (Number.isFinite(p) && p > newest) newest = p;
  }
  return new Date(newest || Date.parse(fallback) || 0);
}

export function buildRss(items: FeedItem[], meta: FeedMeta): string {
  const built = lastModified(items, meta.generated).toUTCString();
  const body = items
    .map((i) => {
      const date = publishedAt(i);
      return (
        `<item><title>${xmlText(i.title)}</title><link>${xmlText(i.url)}</link>` +
        `<guid isPermaLink="false">${xmlText(i.id)}</guid>` +
        (validDate(date) ? `<pubDate>${date.toUTCString()}</pubDate>` : '') +
        `<category>${xmlText(i.tag)}</category><dc:creator>${xmlText(agencies(i.agency))}</dc:creator>` +
        `<description>${xmlText(itemDescription(i))}</description></item>`
      );
    })
    .join('');
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel>` +
    `<title>${xmlText(meta.title)}</title><link>${xmlText(meta.homeUrl)}</link>` +
    `<description>${xmlText(`${meta.description} ${FEED_NOTICE}`)}</description>` +
    `<language>en-us</language><copyright>${xmlText(FEED_NOTICE)}</copyright>` +
    `<lastBuildDate>${built}</lastBuildDate><ttl>60</ttl><generator>${xmlText(meta.siteName)}</generator>` +
    `<atom:link href="${xmlText(meta.selfUrl)}" rel="self" type="application/rss+xml"/>${body}</channel></rss>`
  );
}

export function buildAtom(items: FeedItem[], meta: FeedMeta): string {
  const updated = lastModified(items, meta.generated).toISOString();
  const body = items
    .map((i) => {
      const date = publishedAt(i);
      const stamp = validDate(date) ? date.toISOString() : updated;
      return (
        `<entry><id>urn:federalregister:${xmlText(i.id)}</id><title>${xmlText(i.title)}</title>` +
        `<link rel="alternate" type="text/html" href="${xmlText(i.url)}"/><published>${stamp}</published><updated>${stamp}</updated>` +
        `<author><name>${xmlText(agencies(i.agency))}</name></author><category term="${xmlText(i.tag)}"/>` +
        `<summary type="text">${xmlText(itemDescription(i))}</summary></entry>`
      );
    })
    .join('');
  return (
    `<?xml version="1.0" encoding="UTF-8"?><feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en-US">` +
    `<id>${xmlText(meta.selfUrl)}</id><title>${xmlText(meta.title)}</title>` +
    `<subtitle>${xmlText(`${meta.description} ${FEED_NOTICE}`)}</subtitle><rights>${xmlText(FEED_NOTICE)}</rights>` +
    `<updated>${updated}</updated><generator>${xmlText(meta.siteName)}</generator>` +
    `<link rel="self" type="application/atom+xml" href="${xmlText(meta.selfUrl)}"/>` +
    `<link rel="alternate" type="text/html" href="${xmlText(meta.homeUrl)}"/>${body}</feed>`
  );
}

export function buildJsonFeed(items: FeedItem[], meta: FeedMeta): string {
  return JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: plainText(meta.title),
    home_page_url: meta.homeUrl,
    feed_url: meta.selfUrl,
    description: `${plainText(meta.description)} ${FEED_NOTICE}`,
    language: 'en-US',
    items: items.map((i) => {
      const date = publishedAt(i);
      return {
        id: i.id,
        url: i.url,
        title: plainText(i.title),
        content_text: itemDescription(i),
        ...(validDate(date) ? { date_published: date.toISOString() } : {}),
        tags: [i.tag],
        authors: [{ name: plainText(agencies(i.agency)) }],
      };
    }),
  });
}

/** Weak validator for conditional GET: any byte change in the body changes it. */
export async function weakEtag(body: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(body));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `W/"${hex.slice(0, 20)}"`;
}

export function feedTitle(filters: FeedFilters): string {
  const label = [...filters.tags, ...filters.keywords, ...filters.countries].join(', ');
  return `Aex Terminal: U.S. trade actions${label ? ` (${label})` : ''}`;
}
