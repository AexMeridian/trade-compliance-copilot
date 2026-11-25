-- schedule_b_lines.superior_id is a foreign key back to the same table with no index. Every row deleted (for example when the
-- bulk sync replaces a chapter) made SQLite scan the whole table to check for child rows: one chapter delete read 16 million rows
-- and used a whole day of the free D1 read quota. hts_lines already has this index (0006).
CREATE INDEX IF NOT EXISTS idx_sb_superior ON schedule_b_lines(superior_id);
