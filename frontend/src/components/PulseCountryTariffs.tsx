import { TARIFF_COUNTRY_LABELS } from '../lib/pulseTariffCountries';
import type { PulseSummary } from '../types/pulse';

// Replaces a plain "mentioned in the news N times" ranking with something
// that actually answers "how much pressure is this country under": the
// Section 301 forced-labor determination is the one tariff program in this
// app's data that is both country-specific and broad (it applies across
// nearly the whole HTS schedule, not one product category), so it is the
// only number used to rank and size these bars. Section 338 (Canada, three
// specific chapters) and the Section 232 metals country caps (a reduction,
// not added pressure) are real too, but narrower or opposite in direction --
// folding them into one "total rate" per country would imply a precision
// this data doesn't have, so they're shown as separate notes instead.
export function PulseCountryTariffs({
  tariffs,
  activeCountry,
  onSelect,
}: {
  tariffs: PulseSummary['countryTariffs'];
  activeCountry: string | null;
  onSelect: (country: string | null) => void;
}) {
  const { forcedLabor, extra, capped } = tariffs;
  if (forcedLabor.length === 0) {
    return <p className="text-sm text-ink-faint">No active country-specific tariff data right now.</p>;
  }
  const max = Math.max(...forcedLabor.map((f) => f.ratePct), 1);

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
        {forcedLabor.map((f) => {
          const active = activeCountry === f.country;
          return (
            <li key={f.country}>
              <button
                type="button"
                onClick={() => onSelect(active ? null : f.country)}
                aria-pressed={active}
                className={`flex w-full items-center gap-2 text-left ${active ? 'text-accent' : ''}`}
              >
                <span className={`w-28 shrink-0 truncate text-xs ${active ? 'text-accent' : 'text-ink-muted'}`}>
                  {TARIFF_COUNTRY_LABELS[f.country] ?? f.country}
                </span>
                <span className="h-3 flex-1 bg-hairline">
                  <span className={`block h-full ${active ? 'bg-hue-indigo' : 'bg-hue-cyan'}`} style={{ width: `${Math.max((f.ratePct / max) * 100, 4)}%` }} />
                </span>
                <span className="w-12 shrink-0 text-right tabular-nums text-xs text-ink">{f.ratePct}%</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] leading-relaxed text-ink-faint">
        Section 301 forced-labor determination: {forcedLabor.length} economies, applied across almost every product category. Not the same as being
        mentioned in the news -- this is a real, currently-collected extra duty.
        {extra.length > 0 && (
          <>
            {' '}
            {extra.map((e) => `${TARIFF_COUNTRY_LABELS[e.country] ?? e.country} also faces an extra ${e.ratePct}% under ${e.program} (${e.note}).`).join(' ')}
          </>
        )}
        {capped.length > 0 && (
          <>
            {' '}
            {capped.length} countries ({capped.map((cCode) => TARIFF_COUNTRY_LABELS[cCode.country] ?? cCode.country).join(', ')}) have their Section 232
            metals rate capped at {capped[0].ratePct}% instead of the standard {capped[0].standardPct}% ({capped[0].note}).
          </>
        )}
      </p>
    </div>
  );
}
