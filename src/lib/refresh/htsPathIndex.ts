// The ancestor-text search index (migration 0023). It is derived from
// hts_lines and keyed by line id, so it MUST be rebuilt whenever hts_lines is
// reloaded -- ids shift between HTS revisions, and a stale index would quietly
// attach the wrong lines to a search. Used by the scheduled refresh
// (refresh/hts.ts) and by `npm run seed:path-index` (scripts/), so the SQL has
// one definition. Migration 0023 keeps its own copy of the first build, since
// applied migrations are never edited.
export const HTS_PATH_INDEX_CLEAR_SQL = 'DELETE FROM hts_path_search';

export const HTS_PATH_INDEX_BUILD_SQL = `WITH RECURSIVE anc(leaf, node, depth) AS (
  SELECT id, superior_id, 1 FROM hts_lines WHERE htsno != '' AND superior_id IS NOT NULL
  UNION ALL
  SELECT anc.leaf, h.superior_id, anc.depth + 1
  FROM anc JOIN hts_lines h ON h.id = anc.node
  WHERE h.superior_id IS NOT NULL AND anc.depth < 8
)
INSERT INTO hts_path_search(rowid, path)
SELECT anc.leaf, group_concat(h.description, ' ')
FROM anc JOIN hts_lines h ON h.id = anc.node
GROUP BY anc.leaf`;
