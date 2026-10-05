-- Ancestor-text search index for HTS lines.
--
-- hts_search only indexes a line's OWN description, but in the HTS the words
-- that decide a classification often sit on a parent heading: "6204.62.40.xx
-- Other" is a women's garment only because an ancestor reads "Women's or
-- girls' ... trousers ...". A query for "women's jeans" therefore never reached
-- the 6204 branch. This table indexes, per classifiable line (htsno != ''),
-- the concatenated descriptions of ALL its ancestors, so a match here means
-- "this line sits under a heading that talks about the query's words".
--
-- Standalone (not external-content): the path is derived, not a column of
-- hts_lines. It is rebuilt wholesale by the HTS refresh job
-- (src/lib/refresh/hts.ts, HTS_PATH_INDEX_SQL) -- keep the two in sync.

CREATE VIRTUAL TABLE hts_path_search USING fts5(
  path,
  tokenize='porter unicode61 remove_diacritics 2'
);

WITH RECURSIVE anc(leaf, node, depth) AS (
  SELECT id, superior_id, 1 FROM hts_lines WHERE htsno != '' AND superior_id IS NOT NULL
  UNION ALL
  SELECT anc.leaf, h.superior_id, anc.depth + 1
  FROM anc JOIN hts_lines h ON h.id = anc.node
  WHERE h.superior_id IS NOT NULL AND anc.depth < 8
)
INSERT INTO hts_path_search(rowid, path)
SELECT anc.leaf, group_concat(h.description, ' ')
FROM anc JOIN hts_lines h ON h.id = anc.node
GROUP BY anc.leaf;
