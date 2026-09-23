import type { Confidence } from '../types/case';

const STYLES: Record<Confidence, string> = {
  high: 'border-clear text-clear',
  medium: 'border-review text-review',
  low: 'border-stop text-stop',
};

export function ConfidenceChip({ confidence }: { confidence: Confidence }) {
  return (
    <span className={`inline-block rounded-sm border px-2 py-0.5 text-xs ${STYLES[confidence]}`}>
      {confidence} confidence
    </span>
  );
}
