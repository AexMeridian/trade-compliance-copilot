export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ANTHROPIC_API_KEY: string;
  CLAUDE_RATE_LIMITER: RateLimit;
  PULSE_RATE_LIMITER: RateLimit;
  NEWS_IMAGES?: string; // "off" hides publisher lead images
  MARKET_QUOTES?: string; // "off" disables the Yahoo Finance quote tiles
  BLS_API_KEY?: string; // optional free key (bls.gov/developers) for a higher BLS rate limit; unset works fine at the lower keyless tier
  GLOBAL_TRADE_ALERT_API_KEY?: string; // free self-serve key (globaltradealert.org/api-access); unset simply skips the GTA refresh job, unlike BLS there is no keyless tier
}
