export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  ANTHROPIC_API_KEY: string;
  CLAUDE_RATE_LIMITER: RateLimit;
}
