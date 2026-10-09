-- Case privacy: a case now expires 30 days after it was created, and its creator can delete it
-- at any time with a secret token returned once at creation (only a SHA-256 hash is stored).
-- Seeded sample cases (is_sample = 1) never expire.
ALTER TABLE cases ADD COLUMN expires_at TEXT;
ALTER TABLE cases ADD COLUMN delete_token_hash TEXT;
CREATE INDEX idx_cases_expires ON cases(expires_at);

-- Existing user-created cases get the same 30-day window, counted from when they were created.
UPDATE cases SET expires_at = strftime('%Y-%m-%dT%H:%M:%fZ', created_at, '+30 days') WHERE is_sample = 0 AND expires_at IS NULL;
