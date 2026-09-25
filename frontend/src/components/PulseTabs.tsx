import { SECTION_HUE } from '../lib/pulseColors';

export type PulseTabId = 'overview' | 'policy' | 'markets' | 'news';

export const PULSE_TABS: { id: PulseTabId; label: string; hint: string }[] = [
  { id: 'overview', label: 'Overview', hint: 'The short version' },
  { id: 'policy', label: 'U.S. policy', hint: 'Tariffs, sanctions and export rules' },
  { id: 'markets', label: 'Markets', hint: 'Exchange rates and key economic numbers' },
  { id: 'news', label: 'News', hint: 'Trade-related headlines from around the world' },
];

const TAB_BORDER: Record<PulseTabId, string> = {
  overview: 'border-ink',
  policy: SECTION_HUE.policy.border,
  markets: SECTION_HUE.markets.border,
  news: SECTION_HUE.news.border,
};

// Native buttons with tab roles; the parent owns which panel renders, so
// only the active tab's content is in the page at any time.
export function PulseTabs({ active, onChange, children }: { active: PulseTabId; onChange: (id: PulseTabId) => void; children?: React.ReactNode }) {
  return (
    <div className="mt-8 flex items-end gap-3 border-b border-hairline-strong">
    <div role="tablist" aria-label="Pulse sections" className="flex min-w-0 gap-1 overflow-x-auto">
      {PULSE_TABS.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`pulse-tab-${t.id}`}
            aria-selected={on}
            aria-controls="pulse-tabpanel"
            title={t.hint}
            onClick={() => onChange(t.id)}
            className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-3.5 py-2.5 font-sans text-sm ${
              on ? `${TAB_BORDER[t.id]} font-semibold text-ink` : 'border-transparent text-ink-muted hover:text-ink'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
    {children}
    </div>
  );
}
