export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ANTHROPIC_API_KEY: string;
  ANTHROPIC_WORKSPACE_ID?: string; // only for a user-level key (sk-ant-usr-...), which is not scoped to a workspace
  CLAUDE_RATE_LIMITER: RateLimit;
  PULSE_RATE_LIMITER: RateLimit;
  /** Per visitor, counts only requests the edge cache could not answer (see lib/edgeCache.ts). */
  MISS_RATE_LIMITER: RateLimit;
  WRITE_RATE_LIMITER: RateLimit;
  CLAUDE_IP_DAILY?: string; // max model-calling requests per visitor (hashed IP) per UTC day (default 40)
  DEMO_TOKEN?: string; // optional owner secret: a request sending it in the X-Demo-Token header skips the per-visitor daily quota
  SYNC_TOKEN?: string; // secret for POST /api/pulse/sync (X-Sync-Token header); unset means the route refuses everyone
  CLAUDE_DAILY_CAP?: string; // max Claude-calling requests per UTC day across all visitors (default 300)
  ALERT_EMAIL?: SendEmail; // Email Routing send_email binding; unset until the owner finishes the one-time setup (docs/OPERATIONS.md)
  ALERT_TO?: string;
  ALERT_FROM?: string;
  REMINDER_DATES?: string; // optional "name:YYYY-MM-DD,..." chores for the weekly summary, e.g. key rotation dates
  MONTHLY_BUDGET_USD?: string; // estimated calculator spend per calendar month above which model calls pause (default 30)
  MODEL_CACHE?: string; // "off" disables reuse of earlier identical model answers (used by the accuracy runs, which must see fresh answers)
  NEWS_IMAGES?: string; // "off" hides publisher lead images
  MARKET_QUOTES?: string; // "off" disables the Yahoo Finance quote tiles
  OPENALEX_MAILTO?: string; // optional contact address sent to OpenAlex (its "polite pool" has far higher rate limits than the anonymous one); unset works but may be rate limited (HTTP 429)
  BLS_API_KEY?: string; // optional free key (bls.gov/developers) for a higher BLS rate limit; unset works fine at the lower keyless tier
  CENSUS_API_KEY?: string; // free key (api.census.gov/data/key_signup.html) for the trade-by-partner and foreign-born jobs; unset skips them with a clear status
  GTA_API_KEY?: string; // alias for GLOBAL_TRADE_ALERT_API_KEY; either name works
  GLOBAL_TRADE_ALERT_API_KEY?: string; // free self-serve key (globaltradealert.org/api-access); unset simply skips the GTA refresh job, unlike BLS there is no keyless tier
}
