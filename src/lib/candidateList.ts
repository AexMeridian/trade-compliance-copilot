// The candidate list stored on a classification: what the search returned, trimmed to what helps a reader. Candidates that scored zero are
// noise (a text match on nothing) and are left out; at most five are kept, always including the code the classifier selected and any it named
// as a plausible alternative, each with the reason it is listed.
import type { ClassificationCandidate } from '../types/case.js';

export const MAX_CANDIDATES_SHOWN = 5;

export function shownCandidates(
  all: { code: string; description: string; score: number }[],
  selectedCode: string | null,
  alternatives: string[] = []
): ClassificationCandidate[] {
  const isKept = (c: { code: string; score: number }) => c.code === selectedCode || alternatives.includes(c.code) || c.score > 0;
  const kept = all.filter(isKept);
  // Selected and alternatives first (they are the point of the list), then by score, best first.
  const rank = (c: { code: string; score: number }) => (c.code === selectedCode ? 0 : alternatives.includes(c.code) ? 1 : 2);
  const sorted = [...kept].sort((a, b) => rank(a) - rank(b) || b.score - a.score);
  return sorted.slice(0, MAX_CANDIDATES_SHOWN).map((c) => ({
    code: c.code,
    description: c.description,
    score: c.score,
    reason: c.code === selectedCode ? 'Selected by the classifier' : alternatives.includes(c.code) ? 'Named as a plausible alternative' : `Text-search match (score ${c.score})`,
  }));
}
