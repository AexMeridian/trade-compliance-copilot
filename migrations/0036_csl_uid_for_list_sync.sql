-- A stable key for each Consolidated Screening List entry (the file's own "_id"), so the daily list sync (scripts/sync-lists.ts) can
-- change only the entries that differ instead of rewriting the table. Existing rows have no key yet; the first sync replaces them.
ALTER TABLE csl_entries ADD COLUMN uid TEXT;
CREATE UNIQUE INDEX idx_csl_entries_uid ON csl_entries(uid);
