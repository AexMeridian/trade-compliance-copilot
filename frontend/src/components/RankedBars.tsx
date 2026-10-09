// A ranked list of countries as horizontal bars, each row a button that opens that country.
// Used in the page tops where the globe used to be: the bar length is the measure itself
// (a tariff rate, a count of listed parties, a share of GDP), so the picture and the number agree.
export interface BarRow {
  code: string;
  label: string;
  value: number;
  text: string; // the value as shown, e.g. "25%" or "6,359"
}

export function RankedBars({
  rows,
  activeCountry,
  onSelect,
  limit = 10,
  mobileLimit = 6,
}: {
  rows: BarRow[];
  activeCountry: string | null;
  onSelect: (code: string) => void;
  limit?: number;
  mobileLimit?: number;
}) {
  const shown = rows.slice(0, limit);
  const max = Math.max(...shown.map((r) => r.value), 1);
  return (
    <ul className="flex flex-col">
      {shown.map((r, i) => {
        const on = activeCountry === r.code;
        return (
          <li key={r.code} className={`border-t border-hero-divider first:border-t-0 ${i >= mobileLimit ? 'hidden sm:block' : ''}`}>
            <button
              type="button"
              onClick={() => onSelect(r.code)}
              aria-pressed={on}
              className={`group grid w-full grid-cols-[7.5rem_1fr_4.5rem] items-center gap-3 py-2 text-left sm:grid-cols-[10rem_1fr_5rem] ${on ? 'text-hue-orange-ink' : 'text-hero-ink'}`}
            >
              <span className="truncate text-sm font-medium">{r.label}</span>
              <span className="h-2 bg-hero-card-bg">
                <span
                  className={`block h-full ${on ? 'bg-hue-orange' : 'bg-hue-cyan group-hover:bg-hue-blue'}`}
                  style={{ width: `${Math.max((r.value / max) * 100, 2)}%` }}
                />
              </span>
              <span className="text-right text-sm font-semibold tabular-nums">{r.text}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
