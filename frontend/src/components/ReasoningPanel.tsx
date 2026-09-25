import { useState } from 'react';
import type { ReasoningTrace } from '../types/case';
import { ConfidenceChip } from './ConfidenceChip';
import { ProvenanceBadge } from './ProvenanceBadge';

export function ReasoningPanel({ reasoning }: { reasoning: ReasoningTrace }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 border border-hairline">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left font-sans text-sm text-ink-muted hover:text-ink"
        aria-expanded={open}
      >
        <span>{open ? 'Hide analyst reasoning' : 'Show analyst reasoning'}</span>
        <span aria-hidden="true" className="font-mono">{open ? '−' : '+'}</span>
      </button>
      {open && (
        <div className="border-t border-hairline px-3 py-3">
          <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink">
            {reasoning.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          {reasoning.cited_sources.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-hairline pt-3">
              {reasoning.cited_sources.map((s, i) => (
                <ProvenanceBadge key={i} source={s} />
              ))}
            </div>
          )}
          <div className="mt-3">
            <ConfidenceChip confidence={reasoning.confidence} />
          </div>
        </div>
      )}
    </div>
  );
}
