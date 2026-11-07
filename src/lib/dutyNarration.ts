// The plain-English summary of a computed duty stack, written by code instead of a model. Every number in it comes straight from the stack,
// so it cannot drift from the figures, and an import determination no longer costs a model call.
import type { DutyStackLine, Confidence } from '../types/case.js';

export interface DutyNarration {
  summary: string;
  steps: string[];
  open_issues: string[];
  confidence: Confidence;
}

const rateText = (l: DutyStackLine) => (l.rate_pct !== null ? `${l.rate_pct}%` : 'a rate this app cannot add up');

export function narrateDutyStack(htsCode: string, country: string, lines: DutyStackLine[], totalPct: number | null): DutyNarration {
  const applied = lines.filter((l) => l.applies);
  const skipped = lines.filter((l) => !l.applies);
  const blockers = applied.filter((l) => l.rate_pct === null);
  const needsConfirmation = applied.filter((l) => l.caveat && /line-item|confirm|verify|annex|not yet|undetermined/i.test(l.caveat));

  const summary =
    totalPct !== null
      ? `Estimated duty on HTS ${htsCode}${country ? ` from ${country}` : ''} is ${totalPct}%, the sum of ${applied.length} applying layer${applied.length === 1 ? '' : 's'}${
          needsConfirmation.length > 0 ? `; ${needsConfirmation.length} of them need a line-item check against the source notice` : ''
        }.`
      : `A total cannot be given for HTS ${htsCode}${country ? ` from ${country}` : ''}: ${blockers.map((l) => l.layer).join(', ') || 'a layer'} has a rate that is not a plain percentage (a specific or compound rate), so the duty must be worked out by hand.`;

  const steps = [
    ...applied.map((l) => `${l.layer}: ${rateText(l)} (${l.legal_basis}).`),
    ...skipped.map((l) => `${l.layer}: not applied${l.reason_if_not_applied ? ` (${l.reason_if_not_applied})` : ''}.`),
    totalPct !== null ? `Total of the applying layers: ${totalPct}%.` : 'No total: at least one applying layer has no percentage rate.',
  ];

  const open_issues = needsConfirmation.map((l) => `${l.layer} needs a line-item check against its source notice (see the caveat on that line).`);
  if (blockers.length > 0) open_issues.push(`${blockers.map((l) => l.layer).join(', ')}: rate is not a plain percentage; compute it by hand.`);

  const confidence: Confidence = totalPct === null ? 'low' : needsConfirmation.length > 0 ? 'medium' : 'high';
  return { summary, steps, open_issues, confidence };
}
