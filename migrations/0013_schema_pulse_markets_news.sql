-- Pulse's non-tariff layer: currency/market time series, and trade-relevant
-- world news. Like trade_policy_actions (0011), none of this is curated or
-- model-generated -- rows are exactly what the source published (Frankfurter/
-- ECB reference rates, FRED series, RSS headlines), with news additionally
-- tagged/filtered by deterministic keyword rules (src/lib/pulse/newsTag.ts).

-- One row per (series, observation date). FX pairs use series_id like
-- 'FX:CNY' (USD per 1 unit is NOT stored -- value is units of the quote
-- currency per 1 USD, as Frankfurter returns it); FRED series keep their
-- FRED ids ('SP500', 'DGS10', ...).
CREATE TABLE market_series (
  series_id  TEXT NOT NULL,
  obs_date   TEXT NOT NULL,   -- YYYY-MM-DD
  value      REAL NOT NULL,
  PRIMARY KEY (series_id, obs_date)
);

CREATE TABLE market_series_meta (
  series_id       TEXT PRIMARY KEY,
  label           TEXT NOT NULL,
  unit            TEXT NOT NULL,
  source          TEXT NOT NULL,   -- 'Frankfurter (ECB)' | 'FRED'
  source_url      TEXT NOT NULL,
  last_fetched_at TEXT NOT NULL
);

-- Headline + link only (never article body). id is a hash of the URL so a
-- re-fetched feed upserts instead of duplicating.
CREATE TABLE world_news (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  summary      TEXT,
  url          TEXT NOT NULL,
  source       TEXT NOT NULL,
  category     TEXT NOT NULL,     -- Trade & Supply Chain | Markets & Currency | Elections & Politics | Official
  countries    TEXT,              -- JSON array of country codes (same best-effort extraction as trade_policy_actions)
  published_at TEXT NOT NULL,     -- ISO 8601
  fetched_at   TEXT NOT NULL
);
CREATE INDEX idx_world_news_published ON world_news(published_at);
CREATE INDEX idx_world_news_category ON world_news(category, published_at);

-- Cooldown/claim state for lazy refresh-on-request (src/lib/pulse/refreshLazy.ts):
-- the Workers Free plan's 5-cron-trigger cap is fully used, so freshness comes
-- from refreshing when a request finds a source group past its TTL.
CREATE TABLE pulse_feed_state (
  source_key      TEXT PRIMARY KEY,   -- 'fx' | 'fred' | 'news'
  last_attempt_at TEXT,
  last_success_at TEXT,
  last_note       TEXT
);
