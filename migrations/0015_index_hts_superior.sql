-- hts_lines.superior_id had no index, so expandWithChildren's
-- `WHERE superior_id IN (...)` (src/lib/db.ts) -- run on every single
-- classification search against the full ~31,000-row HTS schedule -- forced
-- a full table scan instead of an index seek. This is the single
-- highest-traffic query in the app; index it.
CREATE INDEX idx_hts_superior ON hts_lines(superior_id);
