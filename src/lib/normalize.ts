// Name normalization shared between the bulk data loaders (scripts/fetch-ofac-sdn.ts,
// scripts/fetch-csl.ts -- which precompute name_normalized/alias_normalized at load
// time) and the runtime fuzzy matcher (src/lib/fuzzyMatch.ts -- which normalizes the
// user's input name the same way at request time). Both MUST use this exact function,
// or the FTS5 pre-filter and the fuzzy scorer will disagree about what "the same name"
// looks like.

const LEGAL_SUFFIXES = [
  'LLC', 'LLP', 'LTD', 'LTDA', 'LP', 'PLC', 'INC', 'CORP', 'CORPORATION', 'CO', 'COMPANY',
  'GMBH', 'AG', 'SA', 'SAS', 'SARL', 'SRL', 'SPA', 'BV', 'NV', 'KFT', 'ZRT', 'AB', 'AS', 'ASA',
  'OY', 'OOO', 'ZAO', 'OAO', 'PAO', 'JSC', 'PJSC', 'FZE', 'FZCO', 'DMCC', 'PTE', 'PTY', 'PVT',
  'KG', 'KOMMANDITGESELLSCHAFT', 'EIRELI', 'CIA', 'ET', 'AL', 'EST', 'HOLDING', 'HOLDINGS',
  'GROUP', 'INTERNATIONAL', 'INTL',
];
const SUFFIX_SET = new Set(LEGAL_SUFFIXES);

// Common single-letter-substitution transliteration variants seen across
// Cyrillic/Arabic/other Romanization schemes. Deliberately small and
// documented as heuristic/incomplete -- see fuzzyMatch.ts.
const TRANSLIT_TOKEN_MAP: Record<string, string> = {
  KH: 'H', ZH: 'J', SHCH: 'SH', TS: 'C', YU: 'U', YA: 'A', IY: 'I', IYA: 'IA',
  MOHAMMED: 'MUHAMMAD', MOHAMED: 'MUHAMMAD', MUHAMED: 'MUHAMMAD', MOHAMAD: 'MUHAMMAD',
};

function stripDiacritics(s: string): string {
  return s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
}

/**
 * Normalizes a party name for fuzzy matching: uppercases, strips diacritics and
 * punctuation, collapses whitespace, strips a trailing legal-entity suffix
 * token (LLC/OOO/Ltd/GmbH/...), and applies a small transliteration-variant
 * token map. Returns both the fully-normalized form and the suffix-stripped
 * token list so callers can decide how much weight to give a suffix mismatch.
 */
export function normalizeName(raw: string): { normalized: string; tokens: string[]; hadSuffix: boolean } {
  let s = stripDiacritics(raw).toUpperCase();
  s = s.replace(/[.,'"()\[\]\/\\\-_]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();

  let tokens = s.split(' ').filter(Boolean);
  let hadSuffix = false;
  if (tokens.length > 1 && SUFFIX_SET.has(tokens[tokens.length - 1])) {
    tokens = tokens.slice(0, -1);
    hadSuffix = true;
  }

  tokens = tokens.map((t) => TRANSLIT_TOKEN_MAP[t] ?? t);

  return { normalized: tokens.join(' '), tokens, hadSuffix };
}

/** Convenience wrapper returning just the normalized string, for load-script use. */
export function normalizeNameString(raw: string): string {
  return normalizeName(raw).normalized;
}
