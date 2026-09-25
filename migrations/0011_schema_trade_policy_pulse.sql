-- Trade Policy Pulse: a live feed of U.S. trade-policy actions pulled from
-- the Federal Register API (see src/lib/pulse/*.ts), plus the sync
-- checkpoint that lets each run fetch only what's new since the last one.
-- Unlike the reference tables in 0001-0009, this data is never curated --
-- every row is exactly what the Federal Register published, tagged by
-- keyword/agency match, never model-generated or hand-edited.
CREATE TABLE trade_policy_actions (
  document_number   TEXT PRIMARY KEY,   -- Federal Register's own id, e.g. "2026-12345"
  title              TEXT NOT NULL,
  abstract           TEXT,
  agency             TEXT NOT NULL,      -- comma-joined agency names as FR reports them
  doc_type           TEXT NOT NULL,      -- RULE | PROPOSED_RULE | NOTICE | PRESIDENTIAL_DOCUMENT
  publication_date   TEXT NOT NULL,      -- YYYY-MM-DD
  tag                TEXT NOT NULL,      -- Tariff | Sanctions | Export Control | Trade Agreement | Other
  html_url           TEXT NOT NULL,
  fetched_at         TEXT NOT NULL
);
CREATE INDEX idx_pulse_actions_pub_date ON trade_policy_actions(publication_date);
CREATE INDEX idx_pulse_actions_tag ON trade_policy_actions(tag);

-- Single-row checkpoint (id is always 1) recording the publication_date
-- through which the feed has been synced, so each run -- cron or manual --
-- only asks the Federal Register API for documents published after it.
CREATE TABLE pulse_sync_state (
  id                 INTEGER PRIMARY KEY CHECK (id = 1),
  last_synced_date   TEXT,
  last_synced_at     TEXT
);
