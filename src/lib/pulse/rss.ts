// Minimal RSS 2.0 item parser -- the Workers runtime has no DOMParser, and
// pulling an XML library in for six known feeds isn't worth the bundle
// weight. Verified against saved real samples of every feed listed in
// newsFeeds.ts (BBC, Guardian, NPR, WTO, ECB, Fed): all are RSS 2.0, fields
// are either plain text or CDATA-wrapped, and dates are RFC 822 in various
// timezones. Headline + link (plus a short plain-text summary) is all this
// ever extracts -- never article body.

export interface RssItem {
  title: string;
  summary: string | null;
  link: string;
  publishedAt: string; // ISO 8601
  imageUrl: string | null; // lead image URL as published in the feed, if any
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : m;
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

function stripTags(s: string): string {
  return s.replace(/<[^>]*>/g, ' ');
}

function tidy(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function field(item: string, tag: string): string | null {
  const m = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`, 'i'));
  if (!m) return null;
  return m[1] !== undefined ? m[1] : m[2]; // raw -- callers decode exactly once
}

const MAX_SUMMARY_CHARS = 280;

// Only images served by the publishers' own image CDNs are ever passed on --
// the URL comes from a third-party feed and ends up in an <img src> in the
// browser, so anything else (other hosts, http:, odd schemes) is dropped.
const IMAGE_HOSTS = new Set(['ichef.bbci.co.uk', 'i.guim.co.uk']);
const TARGET_IMAGE_WIDTH = 460;

function leadImage(rawItem: string): string | null {
  const candidates: { url: string; width: number }[] = [];
  for (const m of rawItem.matchAll(/<media:(?:thumbnail|content)\b[^>]*>/gi)) {
    const tag = m[0];
    if (/\bmedium="(?!image)/i.test(tag)) continue; // video/audio, not a picture
    const url = tag.match(/\burl="([^"]+)"/i)?.[1];
    if (url) candidates.push({ url: decodeEntities(url), width: Number(tag.match(/\bwidth="(\d+)"/i)?.[1] ?? 0) });
  }
  // The renditions offered are small (BBC 240px; Guardian 140/460/700px): take the one closest to what the page shows.
  candidates.sort((a, b) => Math.abs(a.width - TARGET_IMAGE_WIDTH) - Math.abs(b.width - TARGET_IMAGE_WIDTH));
  for (const c of candidates) {
    try {
      const u = new URL(c.url);
      if (u.protocol === 'https:' && IMAGE_HOSTS.has(u.hostname)) return u.toString();
    } catch {
      /* not a URL -- try the next candidate */
    }
  }
  return null;
}

export function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const raw = m[0];
    const title = tidy(stripTags(decodeEntities(field(raw, 'title') ?? '')));
    const link = tidy(decodeEntities(field(raw, 'link') ?? field(raw, 'guid') ?? ''));
    const published = Date.parse(tidy(field(raw, 'pubDate') ?? field(raw, 'dc:date') ?? ''));
    if (!title || !/^https?:\/\//.test(link) || Number.isNaN(published)) continue;

    let summary: string | null = tidy(stripTags(decodeEntities(field(raw, 'description') ?? '')));
    // Several feeds repeat the headline as the description; that adds nothing.
    if (!summary || summary === title) summary = null;
    else if (summary.length > MAX_SUMMARY_CHARS) summary = `${summary.slice(0, MAX_SUMMARY_CHARS - 1).trimEnd()}…`;

    items.push({ title, summary, link, publishedAt: new Date(published).toISOString(), imageUrl: leadImage(raw) });
  }
  return items;
}
