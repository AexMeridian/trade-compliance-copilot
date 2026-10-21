import { useId } from 'react';
import { nameFor, POWER_CODES, SERIES_COLORS } from '../lib/powerCountries';

// The countries highlighted in the charts on a page, as removable chips plus one list to add another. The page keeps the choice in the
// address (?countries=), so it follows the reader from tab to tab and can be shared.
export function CountryPicker({ codes, onChange, max = 4 }: { codes: string[]; onChange: (next: string[]) => void; max?: number }) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[13px] font-semibold text-ink-muted">Highlighted</span>
      {codes.map((c, i) => (
        <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-hairline-strong bg-paper-raised py-1 pl-2.5 pr-1 text-[13px] text-ink">
          <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES_COLORS[i] }} />
          {nameFor(c)}
          {codes.length > 1 && (
            <button type="button" aria-label={`Remove ${nameFor(c)}`} onClick={() => onChange(codes.filter((x) => x !== c))} className="flex h-6 w-6 items-center justify-center rounded-full text-ink-muted hover:bg-hairline hover:text-ink">
              &times;
            </button>
          )}
        </span>
      ))}
      {codes.length < max && (
        <>
          <label htmlFor={id} className="sr-only">
            Add a country
          </label>
          <select
            id={id}
            value=""
            onChange={(e) => e.target.value && onChange([...codes, e.target.value])}
            className="border border-dashed border-hairline-strong bg-paper-raised px-2 py-1 text-[13px] text-ink-muted"
          >
            <option value="">+ Add a country</option>
            {POWER_CODES.filter((c) => !codes.includes(c)).map((c) => (
              <option key={c} value={c}>
                {nameFor(c)}
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
