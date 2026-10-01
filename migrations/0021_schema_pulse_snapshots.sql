-- Citable snapshots: a frozen, point-in-time copy of one chart's data, for a
-- reader (e.g. a journalist) who wants to cite an exact figure that won't
-- silently change under them later. Nothing else in this app works this way
-- today -- `data_as_of`/`last_updated` columns elsewhere are continuously
-- overwritten freshness metadata, not history. A snapshot row is written
-- once by POST /api/pulse/snapshots and never updated or auto-expired.

CREATE TABLE pulse_snapshots (
  id            TEXT PRIMARY KEY,   -- crypto.randomUUID(), same convention as case ids
  chart_type    TEXT NOT NULL,      -- 'tempo' | 'markets' | 'cofer'
  title         TEXT NOT NULL,      -- human-readable chart title, for display and citation text
  params_json   TEXT NOT NULL,      -- JSON: whatever the chart's own controls were set to (range, series ids, ...)
  data_json     TEXT NOT NULL,      -- JSON: the exact data the chart was rendering at capture time
  source_note   TEXT NOT NULL,      -- citation-ready description of where the data came from
  created_at    TEXT NOT NULL       -- server clock, not client-supplied -- see the route
);
CREATE INDEX idx_pulse_snapshots_created ON pulse_snapshots(created_at);
