import type { Context } from 'hono';
import type { Env } from './types/env.js';
import { pageMeta } from '../frontend/src/lib/pageMeta.js';
import { TARIFF_COUNTRY_LABELS } from '../frontend/src/lib/pulseTariffCountries.js';

// The site is a single-page app: every address is answered by the same index.html and the browser then works out the page.
// That left link previews and crawlers that do not run scripts with the home page's title, description and canonical address
// on every URL, and answered unknown addresses with "200 OK". This handler serves the same shell with the tags that belong to
// the address (lib/pageMeta.ts, shared with the app) and a real 404 for addresses that are not pages.
// It runs for page requests only: wrangler.jsonc sends /assets, the icons and the other static files straight to the assets.

const setAttr = (name: string, value: string) => ({
  element(el: Element) {
    el.setAttribute(name, value);
  },
});

export async function servePage(c: Context<{ Bindings: Env }>): Promise<Response> {
  const url = new URL(c.req.url);
  const path = url.pathname;
  if (path.startsWith('/api/')) return c.notFound();

  const country = /^\/country\/([A-Za-z]{2})\/?$/.exec(path);
  const countryName = country ? (TARIFF_COUNTRY_LABELS[country[1].toUpperCase()] ?? null) : null;
  const meta = pageMeta(path, null, null, countryName);

  if (!meta.known) {
    // Not one of the site's pages. A real static file added later still reaches the visitor; anything the assets answer with
    // the app shell (an unknown address) is returned as a 404 carrying that same shell, so the app can show its own page.
    const asset = await c.env.ASSETS.fetch(c.req.raw);
    if (!(asset.headers.get('content-type') ?? '').includes('text/html')) return asset;
    return shell(c, url, meta, 404);
  }
  return shell(c, url, meta, 200);
}

async function shell(c: Context<{ Bindings: Env }>, url: URL, meta: ReturnType<typeof pageMeta>, status: number): Promise<Response> {
  const res = await c.env.ASSETS.fetch(new Request(new URL('/', url), { method: 'GET', headers: c.req.raw.headers }));
  if (!res.ok) return res;
  const isHome = url.pathname === '/';
  let rewriter = new HTMLRewriter()
    .on('title', {
      element(el) {
        el.setInnerContent(meta.title);
      },
    })
    .on('meta[name="description"]', setAttr('content', meta.description))
    .on('link[rel="canonical"]', setAttr('href', meta.canonical));
  if (!isHome) {
    rewriter = rewriter
      .on('meta[property="og:title"]', setAttr('content', meta.title))
      .on('meta[property="og:description"]', setAttr('content', meta.description))
      .on('meta[property="og:url"]', setAttr('content', meta.canonical))
      .on('meta[name="twitter:title"]', setAttr('content', meta.title))
      .on('meta[name="twitter:description"]', setAttr('content', meta.description));
  }
  if (!meta.indexable) {
    rewriter = rewriter.on('head', {
      element(el) {
        el.append('<meta name="robots" content="noindex">', { html: true });
      },
    });
  }
  const out = rewriter.transform(res);
  const headers = new Headers(out.headers);
  if (status === 404) headers.set('Cache-Control', 'no-store');
  return new Response(out.body, { status, headers });
}
