-- Measured D1 writes per refresh run (meta.rows_written summed over the run's statements, which counts index and search-index entries too).
-- The scheduler budgets the daily 100,000-write cap on this number instead of on the declared row count, and the GitHub bulk-data sync
-- (scripts/sync-bulk-data.ts) logs its estimate here. Nullable: older rows have no measurement, and code that reads or writes the column falls
-- back cleanly if this migration has not been applied yet.
ALTER TABLE data_refresh_log ADD COLUMN rows_written INTEGER;
