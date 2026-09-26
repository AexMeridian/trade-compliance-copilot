import { PRESETS, type Preset } from '../lib/pulsePrefs';

// Shown once to a first-time visitor (until they pick, skip, or open the
// guide). One question -- "what describes you?" -- because that is the
// quickest way to turn a wall of trade data into a page about *their* trade
// world; every choice can be changed later under "Customize feed".
const WELCOME_KEY = 'pulse:welcomed:v1';

export function wasWelcomed(): boolean {
  try {
    return window.localStorage.getItem(WELCOME_KEY) === '1';
  } catch {
    return false;
  }
}

export function markWelcomed(): void {
  try {
    window.localStorage.setItem(WELCOME_KEY, '1');
  } catch {
    /* storage blocked: the card will simply show again next visit */
  }
}

const CHOICES: { presetId: string; label: string; blurb: string }[] = [
  {
    presetId: 'trader',
    label: 'I import or export goods',
    blurb: 'Tariffs, trade deals, shipping news, and the currencies and commodities behind your costs.',
  },
  { presetId: 'investor', label: "I'm following the markets", blurb: 'Stocks, commodities and currencies, plus the tariff news that moves them.' },
  { presetId: 'compliance', label: 'I work in compliance or law', blurb: 'Sanctions and export controls, with official announcements first.' },
  { presetId: 'policy', label: 'I follow policy and politics', blurb: 'New rules, trade agreements and elections.' },
  { presetId: 'default', label: "I'm just looking around", blurb: 'Keep everything, exactly as it is.' },
];

export function PulseWelcome({ onPick, onGuide, onSkip }: { onPick: (p: Preset) => void; onGuide: () => void; onSkip: () => void }) {
  return (
    <section aria-label="Welcome" className="card mb-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold text-ink">Welcome to Trade Policy Pulse</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
            This page keeps track of what's changing in world trade: new U.S. tariff and sanctions rules, stock and currency moves, and the news behind them.
            Everything is explained in plain English, and you don't need any background to follow it.
          </p>
        </div>
        <button type="button" onClick={onSkip} className="text-xs text-ink-faint hover:text-ink">
          Skip for now
        </button>
      </div>

      <p className="mt-4 text-sm font-medium text-ink">What best describes you? We'll set the page up for you.</p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {CHOICES.map((c) => {
          const preset = PRESETS.find((p) => p.id === c.presetId);
          if (!preset) return null;
          return (
            <button
              key={c.presetId}
              type="button"
              onClick={() => onPick(preset)}
              className="flex flex-col items-start gap-1 border border-hairline-strong bg-paper-raised px-3 py-2.5 text-left hover:border-accent hover:bg-accent-soft"
            >
              <span className="text-sm font-medium text-ink">{c.label}</span>
              <span className="text-xs leading-snug text-ink-faint">{c.blurb}</span>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-ink-faint">
        You can change this any time with <span className="text-ink-muted">Customize feed</span>. Want a walkthrough first?{' '}
        <button type="button" onClick={onGuide} className="text-accent hover:underline">
          Read the short guide
        </button>
        .
      </p>
    </section>
  );
}
