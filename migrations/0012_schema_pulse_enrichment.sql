-- Adds fields the Federal Register API already returns but the original
-- Pulse sync didn't request: effective_on, comments_close_on, citation --
-- verified live (GET .../documents.json?fields[]=effective_on&...) before
-- writing this migration, not guessed. Also adds `countries`, a best-effort
-- JSON array of country codes extracted from title/abstract text (see
-- src/lib/pulse/country.ts) -- explicitly not authoritative jurisdiction
-- data, just a coverage aid over free text.
ALTER TABLE trade_policy_actions ADD COLUMN effective_on TEXT;        -- YYYY-MM-DD, NULL for most Notices
ALTER TABLE trade_policy_actions ADD COLUMN comments_close_on TEXT;   -- YYYY-MM-DD, NULL unless open for comment
ALTER TABLE trade_policy_actions ADD COLUMN citation TEXT;            -- Federal Register citation, e.g. "91 FR 54658"
ALTER TABLE trade_policy_actions ADD COLUMN countries TEXT;           -- JSON array of country codes, e.g. ["CN","MX"]; "[]" if none matched

CREATE INDEX idx_pulse_actions_comments_close ON trade_policy_actions(comments_close_on);
