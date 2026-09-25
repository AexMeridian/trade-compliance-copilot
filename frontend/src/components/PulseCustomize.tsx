import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { GROUP_HUE, NEWS_HUE, TAG_HUE } from '../lib/pulseColors';
import { TAG_HINTS, NEWS_CATEGORY_HINTS } from '../lib/pulseGlossary';
import {
  DEFAULT_PREFS,
  MARKET_TOPICS,
  NEWS_TOPICS,
  POLICY_TOPICS,
  PRESETS,
  isDefaultPrefs,
  samePrefs,
  type PulsePrefs,
} from '../lib/pulsePrefs';

const MARKET_HINTS_SHORT: Record<string, string> = {
  'U.S. stocks': 'S&P 500, Nasdaq, Dow and the VIX',
  'World stocks': 'Japan, Germany, the U.K., Hong Kong and China',
  'Trade bellwethers': 'FedEx, UPS, Caterpillar, Boeing and other trade-sensitive shares',
  Commodities: 'Oil, natural gas, gold and copper',
  'Rates & dollar': 'The 10-year Treasury yield and the dollar index',
  Currencies: 'The dollar against eight trade partners',
};

function Chip({ on, onClick, dot, title, children }: { on: boolean; onClick: () => void; dot?: string; title?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      title={title}
      className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 font-sans text-xs ${
        on ? 'border-accent bg-accent-soft text-ink' : 'border-hairline-strong text-ink-muted hover:border-ink-faint hover:text-ink'
      }`}
    >
      {dot && <span className={`h-2 w-2 ${dot}`} aria-hidden="true" />}
      {children}
    </button>
  );
}

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="font-sans text-sm font-semibold text-ink">{title}</legend>
      {hint && <p className="mt-0.5 font-sans text-xs text-ink-faint">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
    </fieldset>
  );
}

const toggle = (list: string[], value: string) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

export function CustomizeButton({ open, onClick, custom }: { open: boolean; onClick: () => void; custom: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls="pulse-customize"
      className={`mb-1 ml-auto shrink-0 self-center whitespace-nowrap border px-3 py-1.5 font-sans text-xs ${
        custom ? 'border-accent text-accent' : 'border-hairline-strong text-ink-muted hover:border-accent hover:text-accent'
      }`}
    >
      {custom ? 'My feed (custom)' : 'Customize feed'}
    </button>
  );
}

export function CustomizePanel({
  prefs,
  onChange,
  onClose,
  topCountries,
}: {
  prefs: PulsePrefs;
  onChange: (p: PulsePrefs) => void;
  onClose: () => void;
  topCountries: string[]; // most active first
}) {
  const set = (patch: Partial<PulsePrefs>) => onChange({ ...prefs, ...patch });
  // Selected countries always show (so they can be removed), then the most
  // active others; everything else is in the dropdown.
  const shown = [...prefs.countries, ...topCountries.filter((c) => !prefs.countries.includes(c))].slice(0, Math.max(10, prefs.countries.length));
  const rest = Object.keys(COUNTRY_LABELS)
    .filter((c) => !shown.includes(c))
    .sort((a, b) => COUNTRY_LABELS[a].localeCompare(COUNTRY_LABELS[b]));

  return (
    <section id="pulse-customize" aria-label="Customize your feed" className="mt-5 border border-hairline-strong bg-paper-raised">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-hairline-strong px-4 py-3">
        <div>
          <h2 className="font-serif text-lg font-semibold text-ink">Choose what you follow</h2>
          <p className="mt-0.5 font-sans text-xs text-ink-muted">
            Your choices change the Overview, the hero cards and the ticker. They're saved in this browser only. Nothing selected in a list means everything.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChange(DEFAULT_PREFS)}
            disabled={isDefaultPrefs(prefs)}
            className="border border-hairline-strong px-3 py-1.5 font-sans text-xs text-ink-muted hover:border-accent hover:text-accent disabled:opacity-40"
          >
            Reset to default
          </button>
          <button type="button" onClick={onClose} className="border border-accent px-3 py-1.5 font-sans text-xs text-accent hover:bg-accent-soft">
            Done
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-6 px-4 py-4">
        <Group title="Start from a preset" hint="A quick starting point. You can change anything afterwards.">
          {PRESETS.map((p) => (
            <Chip key={p.id} on={samePrefs(prefs, p.prefs)} onClick={() => onChange(p.prefs)} title={p.blurb}>
              {p.label}
            </Chip>
          ))}
        </Group>

        <div className="grid gap-6 md:grid-cols-2">
          <Group title="U.S. policy topics" hint="Which government actions you want to see.">
            {POLICY_TOPICS.map((t) => (
              <Chip key={t} on={prefs.tags.includes(t)} onClick={() => set({ tags: toggle(prefs.tags, t) })} dot={TAG_HUE[t]?.bg} title={TAG_HINTS[t]}>
                {t}
              </Chip>
            ))}
          </Group>

          <Group title="News topics" hint="Which kinds of headlines you want to see.">
            {NEWS_TOPICS.map((t) => (
              <Chip key={t} on={prefs.newsCats.includes(t)} onClick={() => set({ newsCats: toggle(prefs.newsCats, t) })} dot={NEWS_HUE[t]?.bg} title={NEWS_CATEGORY_HINTS[t]}>
                {t}
              </Chip>
            ))}
          </Group>
        </div>

        <Group title="Countries" hint="Only show policy actions and news that name these countries.">
          {shown.map((c) => (
            <Chip key={c} on={prefs.countries.includes(c)} onClick={() => set({ countries: toggle(prefs.countries, c) })}>
              {COUNTRY_LABELS[c] ?? c}
            </Chip>
          ))}
          {rest.length > 0 && (
            <select
              aria-label="Add another country"
              value=""
              onChange={(e) => e.target.value && set({ countries: [...prefs.countries, e.target.value] })}
              className="border border-hairline-strong bg-paper px-2 py-1.5 font-sans text-xs text-ink-muted focus:border-accent focus:outline-none"
            >
              <option value="">More countries…</option>
              {rest.map((c) => (
                <option key={c} value={c}>
                  {COUNTRY_LABELS[c]}
                </option>
              ))}
            </select>
          )}
        </Group>

        <Group title="Markets" hint="Which market data you want to see.">
          {MARKET_TOPICS.map((t) => (
            <Chip key={t} on={prefs.markets.includes(t)} onClick={() => set({ markets: toggle(prefs.markets, t) })} dot={GROUP_HUE[t]?.bg ?? 'bg-cat-blue'} title={MARKET_HINTS_SHORT[t]}>
              {t}
            </Chip>
          ))}
        </Group>

        <Group title="On my Overview" hint="Turn whole sections off. They stay one click away in their own tabs.">
          <Chip on={prefs.showNews} onClick={() => set({ showNews: !prefs.showNews })}>
            News headlines
          </Chip>
          <Chip on={prefs.showMarkets} onClick={() => set({ showMarkets: !prefs.showMarkets })}>
            Markets at a glance
          </Chip>
        </Group>
      </div>
    </section>
  );
}
