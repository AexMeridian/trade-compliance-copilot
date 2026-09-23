-- Application state: one row per case, holding the full CaseFile as a JSON blob
-- (see src/types/case.ts), plus an append-only reasoning/audit log used by the
-- "Analyst reasoning" UI panel.

CREATE TABLE cases (
  id            TEXT PRIMARY KEY,        -- uuid
  direction     TEXT NOT NULL,           -- import | export
  status        TEXT NOT NULL,           -- draft | module1_done | module2_done | module3_done | complete
  case_file     TEXT NOT NULL,           -- JSON-serialized CaseFile
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  created_by    TEXT,
  is_sample     INTEGER NOT NULL DEFAULT 0,
  sample_key    TEXT                     -- stable slug for seeded sample cases, e.g. "ambiguous-classification"
);
CREATE INDEX idx_cases_status ON cases(status);
CREATE INDEX idx_cases_sample ON cases(is_sample);

CREATE TABLE case_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id     TEXT NOT NULL REFERENCES cases(id),
  module      TEXT NOT NULL,   -- classification | origin | screening | determination
  event_type  TEXT NOT NULL,   -- claude_request | claude_response | candidate_set | user_input
  payload     TEXT NOT NULL,   -- JSON
  created_at  TEXT NOT NULL
);
CREATE INDEX idx_events_case ON case_events(case_id);
