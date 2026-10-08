-- The cross-topic timeline (src/routes/pulseConnections.ts) reads designations
-- by listing date. Without these the three queries scan every row of each list
-- (about 13,000 rows read per uncached request); D1 is billed by rows read.
CREATE INDEX idx_un_listed_on ON un_sanctions_entries(listed_on);
CREATE INDEX idx_uk_date_listed ON uk_sanctions_entries(date_listed);
CREATE INDEX idx_csl_start_date ON csl_entries(start_date);
