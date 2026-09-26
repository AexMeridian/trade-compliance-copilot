import { AGENCY_HINTS, DOC_TYPE_HINTS, TAG_HINTS } from '../lib/pulseGlossary';

// Closed by default -- collapsible via native <details>, same pattern
// PulseFeedList already uses for grouped entries, so it doesn't cost anyone
// who already knows this material any screen space or density. Someone new
// to trade policy opens it once; everyone else never notices it's there.
export function PulseGlossary({ defaultOpen = false }: { defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="card">
      <summary className="cursor-pointer list-none px-4 py-3 text-sm text-ink-muted hover:text-ink [&::-webkit-details-marker]:hidden">
        New to trade policy? What the terms on this page mean
      </summary>
      <div className="grid gap-6 border-t border-hairline p-4 text-sm sm:grid-cols-3">
        <div>
          <h3 className="text-sm font-semibold text-ink">Document types</h3>
          <dl className="mt-2 space-y-2">
            {Object.entries(DOC_TYPE_HINTS).map(([type, hint]) => (
              <div key={type}>
                <dt className="tabular-nums text-xs text-ink">{type}</dt>
                <dd className="text-xs leading-relaxed text-ink-muted">{hint}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">Categories</h3>
          <dl className="mt-2 space-y-2">
            {Object.entries(TAG_HINTS).map(([tag, hint]) => (
              <div key={tag}>
                <dt className="tabular-nums text-xs text-ink">{tag}</dt>
                <dd className="text-xs leading-relaxed text-ink-muted">{hint}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">Agencies</h3>
          <dl className="mt-2 space-y-2">
            {Object.entries(AGENCY_HINTS).map(([agency, hint]) => (
              <div key={agency}>
                <dt className="tabular-nums text-xs text-ink">{agency}</dt>
                <dd className="text-xs leading-relaxed text-ink-muted">{hint}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </details>
  );
}
