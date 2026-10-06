import { PRESETS, type Preset } from '../lib/pulsePrefs';

// Shown once to a first-time visitor (until they pick, skip, or open the
// guide). One question -- "what describes you?" -- because that is the
// quickest way to turn a wall of trade data into a page about *their* trade
// world; every choice can be changed later under "Filter".
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

// One quiet row, not a card: it never pushes the real content down, takes one
// tap to use, and one tap to dismiss. The blurb lives in each button's tooltip.
export function PulseWelcome({ onPick, onSkip }: { onPick: (p: Preset) => void; onSkip: () => void }) {
  return (
    <section aria-label="Personalize this page" className="mb-5 flex flex-wrap items-center gap-x-3 gap-y-2 border border-hairline bg-paper-raised px-3 py-2">
      <span className="text-[13px] text-ink-muted">Show me what matters to:</span>
      <div className="flex flex-wrap gap-1.5">
        {CHOICES.filter((c) => c.presetId !== 'default').map((c) => {
          const preset = PRESETS.find((p) => p.id === c.presetId);
          if (!preset) return null;
          return (
            <button
              key={c.presetId}
              type="button"
              title={c.blurb}
              onClick={() => onPick(preset)}
              className="rounded-full border border-hairline-strong px-3 py-1 text-[13px] font-medium text-ink hover:border-accent hover:bg-accent-soft"
            >
              {SHORT_LABEL[c.presetId] ?? c.label}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={onSkip} aria-label="Dismiss" className="ml-auto text-[13px] text-ink-faint hover:text-ink">
        Dismiss
      </button>
    </section>
  );
}

const SHORT_LABEL: Record<string, string> = {
  trader: 'Importing or exporting',
  investor: 'Markets',
  compliance: 'Compliance',
  policy: 'Policy and politics',
};
