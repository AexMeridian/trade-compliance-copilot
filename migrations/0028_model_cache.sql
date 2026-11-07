-- Answers from the model, reused when the exact same question (instructions, the retrieved candidates and the user's facts, hashed together)
-- is asked again within the retention window. Saves a paid call each time a visitor repeats a case. The key changes whenever the
-- reference data behind the question changes, because the candidates are part of what is hashed, so a weekly data refresh never serves an
-- answer built on the old data. Only the model's structured output is kept, never the question; rows are purged after 14 days.
CREATE TABLE model_cache (
  cache_key   TEXT PRIMARY KEY,   -- sha256 of model + system prompt + user content + tool definition
  tool_name   TEXT NOT NULL,
  output      TEXT NOT NULL,      -- the tool input as JSON
  created_at  TEXT NOT NULL,
  hits        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_model_cache_created ON model_cache(created_at);
