import type { ReactNode } from 'react';
import { MeasureSwitcher } from './MeasureSwitcher';
import { COUNTRY_LABELS } from '../lib/pulseCountries';

// The top of the U.S. abroad and Dollar & allies pages: a headline, a switcher between a few
// plain-language measures, one big figure with a sentence saying what it means, and the picture
// behind that figure (ranked bars or a chart). Everything on it is a real, sourced number;
// each measure supplies its own figure, caption and body. The globe lives on Pulse only.
export interface HeroMeasure<T extends string> {
  id: T;
  label: string;
  figure: ReactNode; // the big number or phrase
  caption: ReactNode; // what the figure means, in a sentence
  body: ReactNode; // ranked bars, chart...
}

export function MeasureHero<T extends string>({
  title,
  sub,
  measures,
  active,
  onMeasure,
  activeCountry,
  onCountry,
  card,
  primary,
  onRefresh,
  syncing,
  updatedText,
  ready,
}: {
  title: string;
  sub: string;
  measures: HeroMeasure<T>[];
  active: T;
  onMeasure: (id: T) => void;
  activeCountry: string | null;
  onCountry: (code: string) => void;
  card: ReactNode;
  primary: { label: string; onClick: () => void };
  onRefresh: () => void;
  syncing: boolean;
  updatedText: string;
  ready: boolean;
}) {
  const current = measures.find((m) => m.id === active) ?? measures[0];
  const countries = Object.keys(COUNTRY_LABELS).sort((a, b) => COUNTRY_LABELS[a].localeCompare(COUNTRY_LABELS[b]));
  return (
    <section className="overflow-x-clip bg-hero-bg text-hero-ink">
      <div className="mx-auto max-w-5xl px-4 pb-16 pt-10 sm:pt-14">
        <h1 className="display text-3xl leading-tight sm:text-4xl lg:text-5xl">{title}</h1>
        <p className="mt-3 max-w-xl text-[15px] leading-snug text-hero-ink-muted sm:text-base">{sub}</p>

        <div className="mt-7">
          <MeasureSwitcher measures={measures} active={current.id} onChange={onMeasure} label="Measure to show" />
        </div>

        <div id="measure-panel" role="tabpanel" aria-live="polite" className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12">
          <div>
            <p className="display text-5xl leading-none tabular-nums sm:text-6xl">{ready ? current.figure : '…'}</p>
            <div className="mt-3 max-w-sm text-[15px] leading-snug text-hero-ink-muted">{ready ? current.caption : 'Loading the latest numbers.'}</div>
          </div>
          <div className="min-w-0">{ready ? current.body : <p className="text-sm text-hero-ink-faint">Loading…</p>}</div>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <label className="sr-only" htmlFor="measure-country">
            Look up a country
          </label>
          <select
            id="measure-country"
            value=""
            onChange={(e) => e.target.value && onCountry(e.target.value)}
            className="border border-hero-border bg-hero-bg px-2 py-2 text-[13px] font-semibold text-hero-ink"
          >
            <option value="">Look up a country…</option>
            {countries.map((c) => (
              <option key={c} value={c}>
                {COUNTRY_LABELS[c]}
              </option>
            ))}
          </select>
          <button type="button" onClick={primary.onClick} className="btn-hero">
            {primary.label}
          </button>
          <button type="button" onClick={onRefresh} disabled={syncing} className="btn-hero-ghost">
            {syncing ? 'Checking…' : 'Check for updates'}
          </button>
          <span className="text-[13px] text-hero-ink-faint">{updatedText}</span>
        </div>

        {activeCountry && card && <div className="mt-6 text-left">{card}</div>}
      </div>
    </section>
  );
}
