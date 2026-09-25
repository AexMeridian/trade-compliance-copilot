-- Audit trail for the scheduled bulk-data auto-refresh (src/scheduled.ts).
-- Answers "did the last scheduled refresh for source X actually run, when,
-- how many rows, and did it fail" -- the existing last_updated/source_url
-- columns on each reference table already show *what* data is current, this
-- shows *whether the refresh mechanism itself* is working. Curated tables
-- (usmca_rules, country_chart, tariff_overlays, eccn_entries) are explicitly
-- out of scope for this log -- they are never auto-refreshed, see README.md.
CREATE TABLE data_refresh_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,          -- 'hts' | 'schedule_b' | 'xref' | 'sdn' | 'csl'
  status TEXT NOT NULL,          -- 'success' | 'error'
  rows_affected INTEGER,
  error_message TEXT,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL
);

CREATE INDEX idx_data_refresh_log_source ON data_refresh_log(source, started_at);
