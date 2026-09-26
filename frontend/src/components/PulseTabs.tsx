import { SECTION_HUE } from '../lib/pulseColors';

export type PulseTabId = 'overview' | 'policy' | 'markets' | 'news' | 'guide';

export const PULSE_TABS: { id: PulseTabId; label: string; hint: string }[] = [
  { id: 'overview', label: 'Overview', hint: 'The short version' },
  { id: 'policy', label: 'U.S. policy', hint: 'Tariffs, sanctions and export rules' },
  { id: 'markets', label: 'Markets', hint: 'Exchange rates and key economic numbers' },
  { id: 'news', label: 'News', hint: 'Trade-related headlines from around the world' },
  { id: 'guide', label: 'Guide', hint: 'New here? How to read this page' },
];

const TAB_BORDER: Record<PulseTabId, string> = {
  overview: 'border-ink',
  policy: SECTION_HUE.policy.border,
  markets: SECTION_HUE.markets.border,
  news: SECTION_HUE.news.border,
  guide: 'border-ink',
};

// Native buttons with tab roles; the parent owns which panel renders, so
// only the active tab's content is in the page at any time.
export function PulseTabs({ active, onChange, children }: { active: PulseTabId; onChange: (id: PulseTabId) => void; children?: React.ReactNode }) {
  return (
    // scroll-mt clears the sticky site header when a link elsewhere reveals the tabs.
    <div id="pulse-tabs" className="mt-8 flex scroll-mt-16 flex-col gap-3 sm:flex-row sm:items-end sm:border-b sm:border-hairline-strong">
      <div
        role="tablist"
        aria-label="Pulse sections"
        className="flex min-w-0 overflow-x-auto border-b border-hairline-strong sm:border-b-0"
        onKeyDown={(e) => {
          const i = PULSE_TABS.findIndex((t) => t.id === active);
          let next = -1;
          if (e.key === 'ArrowRight') next = (i + 1) % PULSE_TABS.length;
          else if (e.key === 'ArrowLeft') next = (i - 1 + PULSE_TABS.length) % PULSE_TABS.length;
          else if (e.key === 'Home') next = 0;
          else if (e.key === 'End') next = PULSE_TABS.length - 1;
          if (next < 0) return;
          e.preventDefault();
          onChange(PULSE_TABS[next].id);
          requestAnimationFrame(() => document.getElementById(`pulse-tab-${PULSE_TABS[next].id}`)?.focus());
        }}
      >
        {PULSE_TABS.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`pulse-tab-${t.id}`}
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              aria-controls="pulse-tabpanel"
              title={t.hint}
              onClick={() => onChange(t.id)}
              className={`shrink-0 whitespace-nowrap -mb-px px-4 py-2.5 text-[15px] font-semibold ${on ? `border-b-4 ${TAB_BORDER[t.id]} text-ink` : 'border-b-4 border-transparent text-ink-muted hover:text-ink'}`}
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
