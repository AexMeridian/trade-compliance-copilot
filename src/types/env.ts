export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ANTHROPIC_API_KEY: string;
  CLAUDE_RATE_LIMITER: RateLimit;
  PULSE_RATE_LIMITER: RateLimit;
  NEWS_IMAGES?: string; // "off" hides publisher lead images
  MARKET_QUOTES?: string; // "off" disables the Yahoo Finance quote tiles
}
