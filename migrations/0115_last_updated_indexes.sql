-- "When was this list last refreshed" runs SELECT MAX(last_updated) on each sanctions table on every freshness check. Without an
-- index that reads every row of the table; with one it reads a single row. Part of keeping the site inside the free D1 read quota.
CREATE INDEX IF NOT EXISTS idx_sdn_last_updated ON sdn_entries(last_updated);
CREATE INDEX IF NOT EXISTS idx_csl_last_updated ON csl_entries(last_updated);
CREATE INDEX IF NOT EXISTS idx_un_last_updated ON un_sanctions_entries(last_updated);
CREATE INDEX IF NOT EXISTS idx_uk_last_updated ON uk_sanctions_entries(last_updated);
