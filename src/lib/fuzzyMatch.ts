// Hand-rolled fuzzy name matching for OFAC SDN / BIS CSL screening (Module 3).
// Deliberately dependency-light: Workers has a finite per-request CPU budget and
// no native bindings, so this avoids pulling in a general-purpose fuzzy-matching
// library and instead implements exactly the two algorithms the spec calls for
// (token-sort pre-filter, then Jaro-Winkler) against an already-small candidate
// set. The candidate set itself comes from an FTS5 pre-filter in src/lib/db.ts
// (searchPartyCandidates) -- this module NEVER scores against the full SDN/CSL
// table directly; see the build plan's Workers CPU budget discussion.

import { normalizeName } from './normalize.js';

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

/** Dice coefficient over character bigrams of the token-sorted (alphabetized)
 * normalized string -- catches reordered names ("Ivanov Petr" vs "Petr Ivanov")
 * cheaply, used as the Stage A pre-filter score. */
export function tokenSortRatio(a: string, b: string): number {
  const sortedA = a.split(' ').filter(Boolean).sort().join(' ');
  const sortedB = b.split(' ').filter(Boolean).sort().join(' ');
  if (sortedA === sortedB) return 1;
  const ba = bigrams(sortedA);
  const bb = bigrams(sortedB);
  if (ba.size === 0 || bb.size === 0) return sortedA === sortedB ? 1 : 0;
  let overlap = 0;
  for (const g of ba) if (bb.has(g)) overlap++;
  return (2 * overlap) / (ba.size + bb.size);
}

/** Standard Jaro-Winkler similarity (0-1), rewarding a shared prefix -- the
 * Stage B precision pass, run only on Stage A survivors. */
export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  const la = a.length;
  const lb = b.length;
  if (la === 0 || lb === 0) return 0;

  const matchDistance = Math.max(0, Math.floor(Math.max(la, lb) / 2) - 1);
  const aMatches = new Array(la).fill(false);
  const bMatches = new Array(lb).fill(false);
  let matches = 0;

  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, lb);
    for (let j = start; j < end; j++) {
      if (bMatches[j] || a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < la; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions = transpositions / 2;

  const jaro = (matches / la + matches / lb + (matches - transpositions) / matches) / 3;

  let prefix = 0;
  for (let i = 0; i < Math.min(4, la, lb); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

export interface MatchScoreResult {
  score: number;
  tokenSortScore: number;
  jaroWinklerScore: number;
  inputHadSuffix: boolean;
  candidateHadSuffix: boolean;
}

const STAGE_A_THRESHOLD = 0.55;
const TOKEN_SORT_WEIGHT = 0.4;
const JARO_WINKLER_WEIGHT = 0.6;

/** Full two-stage score between a raw input name and a raw candidate name.
 * Both are normalized internally with the same normalizeName() used to build
 * name_normalized/alias_normalized at load time (src/lib/normalize.ts), so
 * comparisons are apples-to-apples regardless of legal-suffix noise or basic
 * transliteration variance. */
export function scoreNameMatch(inputRaw: string, candidateRaw: string): MatchScoreResult {
  const input = normalizeName(inputRaw);
  const candidate = normalizeName(candidateRaw);

  const tokenSortScore = tokenSortRatio(input.normalized, candidate.normalized);
  if (tokenSortScore < STAGE_A_THRESHOLD) {
    return {
      score: tokenSortScore * TOKEN_SORT_WEIGHT,
      tokenSortScore,
      jaroWinklerScore: 0,
      inputHadSuffix: input.hadSuffix,
      candidateHadSuffix: candidate.hadSuffix,
    };
  }

  const jaroWinklerScore = jaroWinkler(input.normalized, candidate.normalized);
  const score = TOKEN_SORT_WEIGHT * tokenSortScore + JARO_WINKLER_WEIGHT * jaroWinklerScore;
  return { score, tokenSortScore, jaroWinklerScore, inputHadSuffix: input.hadSuffix, candidateHadSuffix: candidate.hadSuffix };
}

export interface RankedCandidate<T> {
  candidate: T;
  score: MatchScoreResult;
}

/** Scores every candidate against the input name and returns the top `limit`
 * above `minScore`, descending. Intended to run on an already-bounded
 * candidate list (tens, not thousands, of rows) -- see searchPartyCandidates
 * in src/lib/db.ts for how that list is produced. */
export function rankCandidates<T extends { name: string }>(
  inputName: string,
  candidates: T[],
  { limit = 5, minScore = 0.55 }: { limit?: number; minScore?: number } = {}
): RankedCandidate<T>[] {
  return candidates
    .map((candidate) => ({ candidate, score: scoreNameMatch(inputName, candidate.name) }))
    .filter((r) => r.score.score >= minScore)
    .sort((a, b) => b.score.score - a.score.score)
    .slice(0, limit);
}
