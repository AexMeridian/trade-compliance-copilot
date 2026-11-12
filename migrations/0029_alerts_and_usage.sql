-- Two small tables for running the site without watching it.
--
-- model_usage: tokens spent on the calculator's model calls, one row per day and tool, so month-to-date spend can be estimated and a monthly
-- budget enforced (src/lib/modelSpend.ts). Cache hits are not counted because they cost nothing.
CREATE TABLE model_usage (
  day            TEXT NOT NULL,        -- YYYY-MM-DD (UTC)
  tool           TEXT NOT NULL,        -- the forced tool's name, e.g. select_hts_code
  calls          INTEGER NOT NULL DEFAULT 0,
  input_tokens   INTEGER NOT NULL DEFAULT 0,
  output_tokens  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, tool)
);

-- alert_state: what has been reported to the owner, so a problem produces one email, not one a day, and a recovery produces one more.
-- status is 'failing' or 'ok'; last_sent_at is when an email about this key last went out.
CREATE TABLE alert_state (
  key            TEXT PRIMARY KEY,
  status         TEXT NOT NULL,
  detail         TEXT,
  first_seen_at  TEXT NOT NULL,
  last_seen_at   TEXT NOT NULL,
  last_sent_at   TEXT,
  recovery_due   INTEGER NOT NULL DEFAULT 0   -- 1 once a failure was emailed; the all-clear message clears it
);
