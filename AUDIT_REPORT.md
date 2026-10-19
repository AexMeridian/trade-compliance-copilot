# Aex Terminal: pre-launch audit

Audit date: 2026-10-18/19. Commit audited: `ce5f1af` (main). Method: baseline commands, a local `wrangler dev` server, three specialist passes (backend security, frontend and accessibility, performance and operations) run with curl, Playwright, axe, EXPLAIN QUERY PLAN and a counting D1 harness. Top findings were re-verified by the lead; those are marked **Verified**. Nothing was changed in code, and production was not touched.

## 1. Summary

The project is in good shape on the basics: typecheck, build and all 46 unit tests pass, there are no console errors on 20 routes, case ids and delete tokens are sound, every SQL query uses bound parameters, there is no XSS surface, and headers (CSP, HSTS, nosniff, frame-ancestors) are strong. The real risks are **operational on the free plan**, not code correctness:

1. A single client can mint unlimited cache misses on expensive endpoints and burn the 5M-rows/day D1 quota in minutes (verified).
2. The daily cron is likely over the free plan's 50-subrequest limit, which puts the new Power indicator refresh at risk (counted from code; needs confirmation in the Cloudflare logs).
3. The home endpoint is expensive enough that about 1,000 visits a day is estimated to reach the daily quota on its own.
4. Anyone can switch off the calculator for the day by spending the shared AI-call cap with invalid requests (verified).
5. Tablet-width layout overflows horizontally (verified), and the search dialog does not trap focus.

### Baseline (Phase 1)

| Check | Result |
|---|---|
| Typecheck (root and frontend) | Pass, 8.7 s |
| Frontend build | Pass, 7.2 s. Main JS 364 kB (109 kB gzip), CSS 59.5 kB (12 kB gzip), globe data chunk 108 kB, dist about 1.8 MB |
| Unit tests | 46 ok, 0 fail |
| Smoke and a11y suites | ALL OK (as of the last run before the audit) |
| Lint (oxlint) | 0 errors, about 45 warnings (see F-13) |
| `npm audit` | 4 findings: wrangler (high), miniflare (high), sharp (high), fast-xml-parser (moderate). The first three are dev tooling only. fast-xml-parser's advisory concerns `XMLBuilder`, which the code never uses (grep: 0 hits), so it is not reachable |
| Outdated | `@anthropic-ai/sdk` 0.32.1 vs 0.135.0 (very old); wrangler 4.148 vs 4.151; patch bumps for react, vite, playwright |

## 2. Findings (confirmed)

Severity: Critical = security hole, data loss, outage or quota exhaustion likely; High = real bug or major problem users will hit; Medium = noticeable, limited impact; Low = polish. Effort S/M/L. "Risk" is the risk of making the fix.

| ID | Sev | Area | Location | Finding and evidence | Fix | Effort | Risk |
|---|---|---|---|---|---|---|---|
| A-1 (S-1, P-1) | **Critical** | Backend / quota | `src/index.ts:54-67`, `src/lib/edgeCache.ts:31`, `src/routes/pulse/reference.ts:39-100`, `country.ts:78` | The edge-cache key is the whole URL, and `/country/:code` and `?country=` are not validated. **Verified:** `/api/pulse/home?x=1` and `?x=2` both MISS; `/country/QQ` and `/sanctions?country=zz1` MISS and return 200. Measured per miss: sanctions 26,238 rows (52,472 with an offset), `/country/XX` 12,992 rows, `/country/CN?name=zzzz` 10,413. The only gate is 120 requests per minute per IP, so one client reads about 1.5M to 3M rows a minute and can use the 5M/day free quota in 2 to 4 minutes; after that every uncached read errors. | Build a normalized cache key from whitelisted params (as `/power` already does); reject country codes not in the known list before any query; ignore `name` in the key; cap `offset` and `?country` length and escape LIKE wildcards; add indexes `sdn_entries(primary_name)` and `csl_entries(name)` (EXPLAIN shows a full scan plus temp sort today: the default page reads about 52k rows and would read about 200). | M | Low-Med (list each endpoint's real params) |
| A-2 (P-3, S-7) | **High** | Ops / cron | `src/scheduled.ts`, `src/lib/refresh/*`, `wrangler.jsonc:94` | One daily invocation runs about 35 fetches for the daily jobs (pulse 14-16 and up to 68 on a backfill, news 12, others) and the weekly jobs add more. `power_indicators` alone needs 21 World Bank series plus a country list (22 fetches, **verified in code**), and six jobs each re-fetch the country list. On the free plan (50 subrequests per invocation) later jobs will throw "Too many subrequests". Evidence of strain already: local `/api/pulse/data-status` shows "Treasury partly refreshed ... operation was aborted due to timeout". **This directly threatens the new Power data.** Not confirmed at runtime. | Memoize `fetchCountryCodes` per invocation; add a second cron (`wrangler.jsonc` has 1 of the 5 free slots in use; the "Exactly 5 entries" comment is stale) so the weekly indicator jobs run in their own invocation; cap work per invocation at about 40 fetches; log run results in one batch. | S-M | Low |
| A-3 (P-2) | **High** | Backend / quota | `src/routes/pulse/home.ts:80`, `src/index.ts:59` | `/api/pulse/home` costs 29 queries and 14,047 rows per miss (186 kB). With a 60 s TTL and per-datacenter caches, about 1,000 visits a day is estimated at 3.5M to 6.9M rows for this endpoint alone, 5M to 9M including the others (estimate, not measured in production). `/abroad` and `/allies` also load it for a small part. | Precompute the monthly tempo and summary aggregates at sync time into one small row (reads about 1 row instead of 8.5k); raise the TTL to 300 s; have `/abroad` and `/allies` call only what they use. | M | Low |
| A-4 (S-2) | **High** | Backend / abuse | `src/index.ts:114-144` | The shared daily AI cap (300) is incremented before the case is found or the body validated. A POST to a nonexistent case id returns 404 and still counts (confirmed locally: counter went to 3 after 3 bad requests). 20 requests a minute from one IP exhausts it in about 15 minutes, then every visitor gets 503 until midnight UTC. No AI spend occurs, but the calculator is disabled. | Count only just before the AI call, after case and body checks pass (or decrement on 4xx). | S | Low |
| A-5 (F-1) | **High** | Responsive / a11y | `frontend/src/App.tsx:144-163` | **Verified:** horizontal page scroll of 61 px at 768 px, 189 px at 640 px, 0 at 900 px, on every route. The five nav links show from the `sm` breakpoint and do not fit. A 1280 px screen at 200% zoom is a 640 px viewport, so this fails WCAG 1.4.10 for zoomed desktop users and tablets. | Move the nav-link breakpoint from `sm` to `lg` (menu button until then). | S | Low |
| A-6 (F-2) | **High** | Accessibility | `frontend/src/components/SiteSearch.tsx:~106-115` | The dialog is `aria-modal` but has no focus trap: Tab leaves it into the page behind (measured: results, then body, skip link, logo). Also `aria-controls` points to an id that does not exist when the query is empty. | Trap Tab (or native `<dialog>.showModal()`, or `inert` on the page behind). | S-M | Low |
| A-7 (P-5) | **High** | Performance | Suspense fallback / footer, `/`, `/abroad`, `/allies`, `/country/*` | Cumulative layout shift 0.12 (home) to 0.52 (country) on desktop and up to 0.78 on throttled mobile; target is under 0.1. The footer paints under the short loading fallback and jumps about 306 px when the lazy page mounts. | Give the fallback a viewport-height minimum (or defer the footer), reserve space for the hero and aside. | S | Low |
| A-8 (P-6) | **High** (mobile) | Performance | `frontend/src/components/PulseGlobe.tsx:672-709` | On `/` at 375 px with 4x CPU throttle: 36 long tasks, 3.3 s blocking time. Desktop has none. The globe renders every frame; pausing offscreen and reduced-motion handling work. | Cap to 30 fps or use a static globe on coarse pointers and narrow screens. | S | Low |
| A-9 (F-5, F-6) | Medium-High | SEO | `frontend/index.html`, `App.tsx:42-92`, Worker SPA fallback | **Verified:** `/country/cn` and `/nope` both return 200 with the home page's title (the same description and Open Graph tags on all 20 routes). Titles and canonicals are patched in the browser only, so link previews and non-JS crawlers see home metadata for 175 country pages in the sitemap, and unknown URLs are soft-404s. | Rewrite title, description, canonical and Open Graph per path in the Worker (HTMLRewriter); return 404 for paths outside the route table. | M | Low-Med |
| A-10 (S-4) | High if on the free plan (Unverified) | Backend | `src/routes/screening.ts:84-235` | Screening runs roughly 17 to 40 D1 queries per party and allows 10 parties; the free plan allows 50 queries per invocation, so 2 to 3 parties can already fail. Local dev does not enforce it. | Cap parties at 2-3 or batch the queries. Confirm first on a deployed Worker. | M | Medium |
| A-11 (P-4) | High if on the free plan (Unverified) | Ops | `src/lib/refresh/sdn.ts:117-125` | The sanctions reload deletes and reinserts about 44,000 rows plus search-index entries; estimated 150k or more writes against the 100k/day limit, and free-plan CPU may not allow parsing the file. The code's own comments flag the quota concern. | Diff and upsert changed rows by uid. | L | Medium |
| A-12 (S-3) | Medium | Backend / cost | `src/routes/screening.ts:61,84,197` | One screening request makes up to 10 AI calls (one per party) but counts as 1 against the daily cap, so the real ceiling is up to 3,000 calls a day, not 300. | Weight the counter by number of calls or lower the party cap. | S | Low |
| A-13 (S-5) | Medium | Backend | `src/lib/caseStore.ts:43-82`, `src/routes/cases.ts:28-31` | Sample case ids are public and the save routes have no sample guard, so any visitor can overwrite the shared demo cases for everyone (from code reading; not reproduced to avoid corrupting local data). | Copy-on-write or 403 for sample cases. | S | Low |
| A-14 (S-6) | Medium | Backend | `src/routes/pulse/home.ts:33-71` | `POST /api/pulse/sync` is unauthenticated and not under the write limiter: locally it returned `{"ok":true,"rows":203}`. A 60 s global cooldown still allows 1,440 full syncs a day, each 14 to 68 subrequests. | Remove the public route (cron and lazy refresh cover it) or raise the cooldown to 15 minutes and require a header. | S | Low |
| A-15 (F-3) | Medium | Accessibility | `DutyStackTable.tsx:61` | Axe contrast "serious" (18 nodes) on country tariffs in both themes: `opacity-75` drops text to 3.47:1 (light) and 3.40:1 (dark). | Remove the opacity; use a muted color or strike-through. | S | Low |
| A-16 (F-4) | Medium | Accessibility | case report, dark theme | "See all N open issues" link is 4.43:1 on its panel (needs 4.5). | Use a lighter color or underlined ink text. | S | Low |
| A-17 (F-7) | Medium | Accessibility | `App.tsx:108-110` | After a route change focus stays on the clicked link and nothing is announced (0 live regions). | Move focus to main or the heading, or announce the title. | S | Low |
| A-18 (F-8) | Medium | Mobile | header, market strip, list links | 113 touch targets under 44 px on the home page at 375 px (header icons 32 px, ticker links 20 px high). Passes the 24 px AA minimum except the 20 px links. | Enlarge hit areas. | S-M | Low |
| A-19 (P-7, P-8) | Medium | Backend | `country.ts:~140`, `lib/db.ts:518-529`, `country.ts:46` | Country page reads about 10.4k rows: 6 identical overlay reads (474 rows) and a JSON tempo scan (9.3k). The first view of each country also scans sanctions (about 26k rows); a crawler touching 170 countries in a week costs an estimated 4.5M to 8.8M rows. | Load overlays once; precompute per-country tempo and sanction counts in the weekly job. | M | Low |
| A-20 (P-9) | Medium | Backend | various | Cheap endpoints with oversized scans and short TTLs (`/coverage` 13.8k rows for 148 bytes, `/nato-defense` 5.3k rows, `/sanction-counts` 32k per miss), `/feed` uncached, and GETs on `/tic` and `/news` that perform writes. | Longer TTLs, normalized keys. | S | Low |
| A-21 (P-10) | Medium | Frontend | `Pulse.tsx:148,163` | Markets and news poll every 5 minutes even in a hidden tab (576 requests a day per open tab). | Add the visibility guard used elsewhere. | S | Low |
| A-22 (P-11) | Medium | Ops | `/api/health` | Returns a constant `{"ok":true}` without touching D1, so it cannot detect an outage or exhausted quota. | `SELECT 1` plus age of last refresh. | S | Low |
| A-23 (P-12) | Medium (Unverified) | Ops | `wrangler.jsonc`, `.github/workflows/ci.yml` | `frontend/dist` is gitignored and `wrangler.jsonc` has no build step, so the deploy only works if Workers Builds' own settings run the frontend build. It evidently has (the last deploy worked), but this is not recorded in the repo, and CI never runs a deploy dry run, smoke or accessibility checks. | Record the build command in `wrangler.jsonc` and run smoke/a11y in CI. | S | Low |
| A-24 (P-13) | Medium | Performance | `frontend` bundle | 364 kB main chunk loads on every route; `siteSearch`, guides and tab content could be split for roughly 20-30 kB gzip. | Lazy-split. | M | Low |
| A-25 (S-8) | Low-Med | Backend | `screening.ts:69-72`, `origin.ts:17-19`, `determination.ts:46,134,174` | A JSON `null` body returns 500 instead of 400; non-string fields throw; a missing HTS line returns 500 instead of 404. | Normalize and validate inputs. | S | Low |
| A-26 (S-9, P-17) | Low | Backend | `routes/pulse/status.ts:34-37` | `/data-status` returns raw upstream error text publicly (hostnames, paths; no secrets). | Return short generic text. | S | Low |
| A-27 (S-10, P-16) | Low | Backend | `routes/pulse/home.ts:168-239` | Snapshot and log tables grow without a cap (the `months` parameter gives many variants). The comment at line 23 saying no limiter is needed is stale. | Allowed month values; periodic purge. | S | Low |
| A-28 (F-9, F-10) | Low | Frontend | `Snapshot.tsx`, error messages | A server error on a snapshot shows "Snapshot not found"; some messages expose a raw error body ("(x)"). | Distinguish 404 from failure; sanitize. | S | Low |
| A-29 (F-11, F-12) | Low | Accessibility | `MobileMenu.tsx:17-30`, case wizard | Escape drops focus to body; wizard has no h1; beta banner sits outside any landmark. | Return focus; add heading and landmark. | S | Low |
| A-30 (P-14, F-16) | Low | Performance | `index.css:3-8` | No font preload; about 10 dead `.woff` fallbacks in the output; one 51 kB serif used in 6 places. | Preload critical fonts; trim. | S | Low |
| A-31 (P-15) | Low | Performance | `/compare?view=power` | 9,248 DOM nodes (mobile 4x LCP 2.3 s). | Collapse or paginate rows. | M | Low |
| A-32 (S-11) | Low | Backend | `caseStore.ts:76-82` | Concurrent steps on one case can overwrite each other (accepted in the code's own header). | Version column. | M | Low |
| A-33 (F-13..F-15, P-18) | Low | Code health | see lint output | About 45 oxlint warnings (set-state-in-effect, refs during render in `useLiveArcs.ts:27`, Date during render); no abort handling on about 22 fetching components (stale-data risk on rapid param changes); files over 900 lines (`PulseGlobe`, `Pulse`); stale cron comments. `@anthropic-ai/sdk` is 0.32.1 against 0.135.0. | Incremental cleanup; update the SDK with a test. | M | Low-Med |

## 3. Unverified concerns (kept separate on purpose)

- Whether production runs on the free plan: A-2, A-10 and A-11 depend on it. The Workers dashboard and Cron Trigger logs will show actual subrequest errors.
- Real production D1 rows read and written, and edge-cache behavior across datacenters. All daily totals above are modeled from per-request measurements.
- Whether D1 `batch()` counts once against the 50-queries-per-invocation limit.
- Whether `/abroad` shows an error message (instead of skeletons) when the API fails.
- Real screen-reader behavior; real-device mobile performance (all mobile numbers are emulated).
- Local GTA row costs (the table is empty locally).

## 4. Already good (do not "fix")

Random UUID case ids and hashed delete tokens with constant-time comparison; bound parameters everywhere and quoted FTS input; no `innerHTML` and strict feed escaping; strong CSP, HSTS, nosniff and frame-ancestors; 32 KB body limit verified for normal and chunked bodies; per-IP limiters on AI and write routes; change-gated writes and the row-budgeted bulk scheduler; stale-on-error edge cache with independently degrading panels; immutable asset caching; globe pauses offscreen and honors reduced motion, no leaks after route round trips; tablists with correct roving keyboard support; no console errors on 20 routes at 375, 768 and 1280 px; `/power` and `/un-alignment` use normalized cache keys and one 28-row read.

## 5. Proposed fix plan

| Batch | IDs | Why first |
|---|---|---|
| 1. Protect the free quota | A-1, A-4, A-14, A-12 | Cheap abuse paths that can take the site down |
| 2. Make the cron fit | A-2, then A-22 and A-23 | Required for the Power data to load reliably; run before more traffic arrives |
| 3. Reduce steady-state reads | A-3, A-19, A-20, A-21 | Keeps normal traffic under the daily quota |
| 4. Layout and accessibility | A-5, A-6, A-7, A-15, A-16, A-17, A-29 | User-visible, small, low risk |
| 5. SEO | A-9 | Medium effort; worth it for country and snapshot pages |
| 6. Mobile performance | A-8, A-18, A-24, A-30 | After the above |
| 7. Robustness and cleanup | A-13, A-25, A-26, A-27, A-28, A-33 | Low risk |
| Deferred until confirmed on the live plan | A-10, A-11, A-31, A-32 | Verify in the Cloudflare dashboard first |

## 6. Manual items for the owner

- Rotate the previously exposed Cloudflare token and the two Anthropic keys.
- Confirm in the Cloudflare dashboard which Workers plan production uses and look at the Cron Trigger logs after tonight's 05:00 UTC run.
- Set up a D1 usage alert at about 60% of the 5M-rows/day limit.
- Set `ANTHROPIC_WORKSPACE_ID` and verify with one real call.
- Written permission from Pew; counsel review of UNESCO's CC BY-SA licence; a dated copy of Afrobarometer's terms.

---

## 7. Status after fixes (seven batches, committed locally, not pushed)

Commits: `86d4dc5` (batch 1), `6a93b0a` (2), `44312d6` (3), `b09b3c4` (4), `6805fd3` (5), `7dec5c9` (6), `c8d08d7` (7). Every batch was verified with typecheck, the unit tests, the smoke suite and the accessibility suite (both themes, 1280 and 390 px); the accessibility suite now also covers a sample case, its report and the tariffs and sanctions tabs.

### Metrics, before and after

| Measure | Before | After |
|---|---|---|
| Unit tests | 46 | 61 (new: cache keys, miss limiter, scheduler groups, page metadata) |
| Typecheck, build, smoke, a11y | pass | pass |
| Horizontal overflow at 768 / 640 px | 61 px / 189 px | 0 / 0 (also 360 to 1280) |
| Cache keys for `/home?x=1`, `/home?x=2` | two entries | one entry; invalid country codes answer 404; non-country text on `/sanctions` answers 400 |
| `/api/pulse/home` rows read, cold miss | 14,049 | 5,513 once the aggregate is cached (-61%), and its cache window is 5x longer |
| `/api/pulse/country/CN` rows read | 10,408 | 10,014 first view, 740 afterwards (a country's monthly counts are kept for an hour) |
| Layout shift, desktop `/abroad`, `/allies`, `/country/cn`, Power compare | 0.43, 0.42, 0.56, 0.41 | 0.02, 0.00, 0.16, 0.00 |
| Layout shift, home | 0.08 to 0.13 | 0.13 (unchanged; the hero panel moves as it loads) |
| Main JS | 364.1 kB (109.3 gzip) | 365.2 kB (109.7 gzip); the search index (3 kB gzip) now loads on first use, offset by new code |
| dist size | about 1.8 MB | 1.68 MB |
| oxlint warnings | about 45 | 39 (0 errors) |
| `/nope`, `/country/zz` | 200 with the home page title | 404 with the shell; every page serves its own title, description, canonical and Open Graph tags |

### Status of every finding

| ID | Status | Note |
|---|---|---|
| A-1 | **Fixed** (batch 1) | Normalized keys per endpoint, validated parameters, a per-visitor limit on cache misses (`MISS_RATE_LIMITER`, 40/min; stale copy served when limited). The two suggested sanctions indexes were deliberately not added: each would add about 26,000 writes to every weekly sanctions reload and make A-11 worse |
| A-2 | **Fixed in code** (batch 2) | Three triggers (05:00 daily, 06:00 reference reloads, 07:00 indicators) with a 40-request budget; country list fetched once. Not confirmed at runtime: the local scheduled trigger would not run here, so check the first live runs in the Cloudflare cron logs |
| A-3 | **Mostly fixed** (batch 3) | Aggregates cached, 5-minute window. `/abroad` and `/allies` still load the full home payload |
| A-4 | **Fixed** (batch 1) | The daily AI ceiling is claimed immediately before each call, after validation. It now counts Claude calls, not requests |
| A-5 | **Fixed** (batch 4) | Nav links appear from 1024 px; the menu button carries them below |
| A-6 | **Fixed** (batch 4) | Tab and Shift+Tab stay inside the dialog; verified with a keyboard run |
| A-7 | **Mostly fixed** (batch 6) | See the metrics table: country page 0.16 and home 0.13 are still above 0.1 |
| A-8 | **Fixed** (batch 6) | 30 frames a second cap on touch-first and narrow screens. Not re-measured on a real phone |
| A-9 | **Fixed** (batch 5) | Worker serves per-page tags and real 404s. Pages now cost one Worker request each; assets and static files bypass it |
| A-10 | **Deferred** | Needs confirmation of the production plan; screening is capped at 10 parties |
| A-11 | **Deferred** | Large change (diff and upsert instead of reload); confirm the plan and write usage first |
| A-12 | **Fixed** (batch 1) | Counted per Claude call |
| A-13 | **Fixed** (batch 7) | Sample cases are read-only (403) |
| A-14 | **Fixed** (batch 1) | 15-minute cooldown and write limiter on `/sync` |
| A-15, A-16 | **Fixed** (batch 4) | Verified by axe on the tariffs tab and the case report in both themes |
| A-17 | **Fixed** (batch 4) | Focus moves to the page after navigation |
| A-18 | **Partly fixed** (batch 6) | Header, logo, nav and ticker reach 44 px on touch devices. In-page text links (for example "All news", 20 px high) are unchanged |
| A-19 | **Half fixed** (batch 3) | Overlays read once; country tempo cached. The per-country sanctions scan on first view is not precomputed yet |
| A-20 | **Mostly fixed** (batch 3) | Longer windows for coverage and NATO; home feed cached. GETs that write (`/tic`, `/news` lazy refresh) are unchanged |
| A-21 | **Fixed** (batch 3) | Polling only while the tab is visible |
| A-22 | **Fixed** (batch 2) | `/api/health` checks the database |
| A-23 | **Documented, not changed** | The Workers Builds build command is recorded in `docs/OPERATIONS.md`. It is a dashboard setting, so I did not put a second build step in `wrangler.jsonc`; confirm it is `npm run build:frontend` |
| A-24 | **Partly** (batch 6) | Search index split out; the rest of the main chunk is unchanged |
| A-25 | **Fixed** (batch 7) | null bodies give 400; missing HTS line is 422 |
| A-26 | **Fixed** (batch 7) | Reason kept, web addresses removed |
| A-27 | **Fixed** (batch 7) | Fixed range list; refresh log trimmed to 90 days. Snapshots themselves are never deleted because their links must keep working |
| A-28 | **Fixed** (batch 7) | A server error is no longer shown as "not found" |
| A-29 | **Fixed** (batch 4) | Menu focus, wizard heading, labeled rate strip. Axe "region" no longer reported |
| A-30 | **Partly** (batch 6) | Wordmark font is Latin only. No preload (it needs a build plugin for hashed names) |
| A-31 | **Not done** | The 190-row Power compare table is not paginated |
| A-32 | **Deferred** | Concurrent writes to one case; accepted by the code's own design note |
| A-33 | **Partly** | 6 warnings fixed. The SDK upgrade (0.32.1 to current) is deferred: it changes API call shapes and needs the AI-assisted checks tested against a real key |

### Things to do yourself

1. Check the first live cron runs (05:00, 06:00 and 07:00 UTC) at `/api/pulse/data-status` and in the Cloudflare Cron Trigger logs. The six Power indicator sources are the ones to watch.
2. Confirm in the Cloudflare dashboard which Workers plan production runs on, and that the Workers Builds build command is `npm run build:frontend`.
3. Before pushing, run `npm run db:migrate:remote` only if a new migration is added (none was in these batches). The push adds a rate-limiter binding (`MISS_RATE_LIMITER`) to `wrangler.jsonc`; Cloudflare creates it on deploy.
4. Rotate the exposed Cloudflare token and the two Anthropic keys; set `ANTHROPIC_WORKSPACE_ID`.
5. Pages now go through the Worker, so check the live site after the deploy: the home page, a country page, `/nope` (404) and `/robots.txt`.
6. Set a D1 usage alert at about 60% of the 5M-rows-read/day limit.
