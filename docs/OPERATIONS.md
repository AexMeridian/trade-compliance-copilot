# Operations and launch checklist

Things that live outside the code: they need an account login, a decision or a professional. Items marked "code" are
already handled in the repository.

## Cloudflare dashboard (owner)

| Item | Why | Status |
|---|---|---|
| SSL/TLS, Edge Certificates: turn on **Always Use HTTPS** and **Automatic HTTPS Rewrites** | `http://aexterminal.com` should redirect to HTTPS. The Worker also redirects (code), but this catches static files too | to do |
| DNS: add a `www` record and a redirect rule to the apex | `www.aexterminal.com` does not resolve today | to do |
| SSL/TLS: minimum TLS 1.2, enable **HSTS preload** only after confirming every subdomain serves HTTPS | Preload is hard to undo | to decide |
| DNS: enable **DNSSEC** and add a **CAA** record for your certificate authority | Prevents spoofed DNS and rogue certificates | to do |
| Security, WAF: add a rate-limiting rule on `/api/*` (for example 300 requests per 10 seconds per IP) and turn on **Bot Fight Mode** | A second layer behind the Worker's own limits | to do |
| Turnstile (free) on case creation | Stops scripted creation of calculator cases | optional |
| Notifications: usage alerts for Workers requests and D1 writes | The free plan allows 100,000 of each per day | to do |
| D1: note that **Time Travel** restores the last 30 days; export `cases` and `pulse_snapshots` weekly | Everything else can be rebuilt from public sources | to do |
| Workers: turn on Observability (logs) | Needed to investigate errors | to do |
| Rotate the API token and the Anthropic key that were pasted into chat | They should be treated as exposed | to do |

## Monitoring (owner)

- Uptime monitor (UptimeRobot, Better Stack or Cloudflare Health Checks) on `https://aexterminal.com/api/health`, alert by email.
- A second check on `https://aexterminal.com/api/pulse/data-status`: alert if a source's `lastSuccess` is older than 3 days
  (weekly sources: 9 days).
- Review `data_refresh_log` after the first weekly bulk reload (sanctions lists are the heaviest job).
- Search Console and Bing Webmaster Tools: verify the domain, submit `sitemap.xml`.

## Email and domain (owner)

- `CEO@AexMeridian.com`: publish SPF, DKIM and a DMARC policy (start with `p=none`, move to `quarantine`) so mail sent from and
  to the address is trusted. Consider a role address such as `contact@aexterminal.com`.
- The address in `security.txt` expires on 2027-10-09; renew it before then.

## Legal and compliance (owner and counsel)

- Have a Colorado attorney review the Terms of use and Privacy policy. Points to raise: the liability cap and indemnity
  wording, the one-year claim period, breach-notice timing, and whether the calculator should require an acknowledgement.
- Check the news feeds' terms. BBC, The Guardian, NPR and others provide RSS for non-commercial use. The site shows only
  headlines, links and a short summary and is free with no ads, but it is operated by a company. Keep an official-source
  fallback (ECB, Federal Reserve, Federal Register) if a publisher objects.
- Quotes from Yahoo Finance are switched off. Do not turn them back on without a licensed market-data source.
- Trademark: run a clearance search and consider filing for "Aex Terminal" (USPTO, classes 9, 36, 42).
- Keep the LLC in good standing: Colorado periodic report, registered agent, a separate bank account.
- Accept the data-processing terms of Cloudflare and Anthropic in their dashboards. Mention both on the Privacy page (done).
- Consider professional liability (errors and omissions) cover if the calculator is promoted.
- If the site is promoted in the EU or UK, check whether an EU or UK representative is required under the GDPR.
- Add real names and credentials to `SITE.team` in `frontend/src/lib/site.ts` when ready; nothing is invented while it is empty.
- Accessibility: commission an independent audit and VPAT before selling to government or large companies.

## Already handled in code

- Security headers (CSP without third-party scripts, HSTS, COOP, nosniff, frame denial, strict referrer policy), HTTP to HTTPS
  redirect in the Worker, request size limit (32 KB), per-IP rate limits, a daily cap on AI calls, input limits (2,000
  characters of product description, 10 parties, 100 origin components), parameterised SQL everywhere, no cookies.
- Calculator data expires after 30 days; creators can delete a case with a secret token.
- Citable snapshots are rebuilt on the server, so nobody can publish made-up data under the site's name.
- Error boundary so a crash shows a message instead of a blank page; a stale-chunk reload after a release.
- CI runs typecheck, unit tests and build on every push, plus `npm audit` for production dependencies weekly.
- `security.txt`, `robots.txt`, sitemap (home, sections, legal pages and every country page), canonical links per page.

## Known and accepted

- `npm audit` reports a high-severity advisory in `sharp`, pulled in by `wrangler` (the local development tool). It is not
  part of the deployed site. Upgrade wrangler when the dev server is stopped.
- Unknown addresses return HTTP 200 with a "page not found" screen marked `noindex` (single-page-app behaviour on the free
  plan). Search engines respect the `noindex`.
- Uptime, DMARC, DNSSEC and the weekly export need the owner's accounts.

## Open-data roadmap (what is built, what is next)

Built: Treasury yield curve and foreign holders of U.S. Treasuries (TIC), IMF monthly commodity prices, and presidential
documents (executive orders, proclamations, national-emergency notices) in the Federal Register feed.

Next, in priority order (see the plan in the repository history for detail):
1. Sanctions country from the source's structured address field instead of a text match, and "added this week" detection.
2. Named-party detection: sanctioned names found inside actions and news (exact normalized match only).
3. More lists: Canada, Switzerland, Australia. The **EU consolidated list is a 25 MB XML/CSV file**; it is too large to parse
   inside a free-plan Worker in one pass, so it needs a streaming parser or a smaller extract before it can be added.
4. GLEIF parent lookups in screening; watchlists by name and HS chapter.
5. World Bank / IMF country indicators to refresh the one-time country snapshot.

Known upstream behaviour: the Treasury yield-curve feed answers slowly (about 17 seconds), so it only ever refreshes in the
background; the IMF PCPS key is `G001.<indicator>.USD.M`.

## Database read budget (free plan: 5,000,000 rows read per day)

On 2026-10-13 the daily read limit was exceeded and the database refused reads until 00:00 UTC. Cause: every page view (and the
header ticker, which also polled every 5 minutes in any open tab) made calls that read tens of thousands of rows with no caching,
and each country page scanned about 51,000 sanctions rows. Changes made:

- The startup calls (`/home` 60 s, `/markets`, `/news`, `/summary`, `/tempo` 5 min) and country pages (1 hour) are held at the edge.
- `/markets` reads only the series it shows (about 4,500 rows instead of every stored row), using index range scans.
- A country's sanctions text-match counts are stored for a week in one `pulse_feed_state` row instead of being recomputed
  (`sanc:<country>`); the country name is checked against the country code first, so arbitrary names cannot create rows or scans.
- The ticker polls every 15 minutes and only while the tab is visible.
- If the database is unavailable, cached endpoints serve their last good copy for up to a day (`X-Edge-Cache: STALE`).

Watch it: Cloudflare dashboard > Storage & Databases > D1 > the database > Metrics ("Rows read"). Set a usage notification at
about 60 percent of 5 M. If the site outgrows the free plan, Workers Paid ($5 a month) includes 25 billion rows read.
