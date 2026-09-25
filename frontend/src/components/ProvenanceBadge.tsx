import type { Provenance } from '../types/case';

const TIER_LABEL: Record<1 | 2 | 3, string> = {
  1: 'Primary source',
  2: 'Official secondary source',
  3: 'Secondary analysis',
};

export function ProvenanceBadge({ source }: { source: Provenance }) {
  return (
    <a
      href={source.source_url}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 border border-hairline bg-paper-raised px-2 py-0.5 font-sans text-xs text-ink-muted no-underline hover:border-accent hover:text-accent"
      title={source.source_url}
    >
      <span>{TIER_LABEL[source.source_tier]}</span>
      <span className="font-mono text-[11px] text-ink-faint">
        {source.data_as_of ? `as of ${source.data_as_of}` : `updated ${source.last_updated}`}
      </span>
    </a>
  );
}
