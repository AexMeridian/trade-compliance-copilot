-- Alerts raised when a Federal Register notice about a hand-verified program (Section 232/301/338 duties, USMCA rules of origin,
-- export-control rules, CBP user fees) is published after that program's data was last verified. The watcher (src/lib/refresh/curatedWatch.ts)
-- adds them from notices the daily Pulse sync already holds, so it costs no outside requests and no model calls. The calculator shows a
-- pending alert as an open issue on any case the program touches and will not call such a case clear. An alert clears itself when the
-- program's data_as_of moves past the notice's publication date (the data was re-verified), or by hand with
--   UPDATE curated_change_alerts SET status = 'dismissed', note = '...' WHERE document_number = '...' AND program = '...';
-- Nothing here ever changes a rate: updating curated data stays a human, source-checked step.
CREATE TABLE curated_change_alerts (
  document_number  TEXT NOT NULL,
  program          TEXT NOT NULL,      -- sec232 | sec301 | sec338 | usmca | export_controls | customs_fees
  title            TEXT NOT NULL,
  publication_date TEXT NOT NULL,
  effective_on     TEXT,
  html_url         TEXT NOT NULL,
  detected_at      TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'pending',   -- pending | resolved | dismissed
  resolved_at      TEXT,
  note             TEXT,
  PRIMARY KEY (document_number, program)
);
CREATE INDEX idx_curated_alerts_status ON curated_change_alerts(status, program);
