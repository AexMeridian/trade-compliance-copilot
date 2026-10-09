import { INFLUENCE_SECTION_HUE } from '../lib/pulseColors';

export type InfluenceTabId = 'overview' | 'pressure' | 'reach' | 'alliances' | 'sanctions' | 'guide';

export const INFLUENCE_TABS: { id: InfluenceTabId; label: string; hint: string }[] = [
  { id: 'overview', label: 'Overview', hint: 'The short version' },
  { id: 'pressure', label: 'Trade measures', hint: 'Tariffs, sanctions and export controls the U.S. applies to other countries' },
  { id: 'reach', label: 'Reach', hint: "The dollar's reach, and diplomatic and political headlines" },
  { id: 'alliances', label: 'Alliances', hint: 'Which countries belong to NATO, G7, G20, BRICS and USMCA, and recent U.S. measures naming them' },
  { id: 'sanctions', label: 'Sanctions', hint: 'Browse the OFAC and Commerce/State sanctioned-entity lists by country' },
  { id: 'guide', label: 'Guide', hint: 'What the trade-measures and reach sections show, where the data comes from, and their limits' },
];

const TAB_BORDER: Record<InfluenceTabId, string> = {
  overview: 'border-ink',
  pressure: INFLUENCE_SECTION_HUE.pressure.border,
  reach: INFLUENCE_SECTION_HUE.reach.border,
  alliances: INFLUENCE_SECTION_HUE.alliances.border,
  sanctions: 'border-hue-violet',
  guide: 'border-ink',
};

// Same tab-bar idiom as PulseTabs, over a different, Influence-specific tab list.
export function InfluenceTabs({ active, onChange, children }: { active: InfluenceTabId; onChange: (id: InfluenceTabId) => void; children?: React.ReactNode }) {
  return (
    <div id="influence-tabs" className="mt-8 flex scroll-mt-16 flex-col gap-3 sm:flex-row sm:items-end sm:border-b sm:border-hairline-strong">
      <div
        role="tablist"
        aria-label="U.S. abroad sections"
        className="flex min-w-0 overflow-x-auto border-b border-hairline-strong sm:border-b-0"
        onKeyDown={(e) => {
          const i = INFLUENCE_TABS.findIndex((t) => t.id === active);
          let next = -1;
          if (e.key === 'ArrowRight') next = (i + 1) % INFLUENCE_TABS.length;
          else if (e.key === 'ArrowLeft') next = (i - 1 + INFLUENCE_TABS.length) % INFLUENCE_TABS.length;
          else if (e.key === 'Home') next = 0;
          else if (e.key === 'End') next = INFLUENCE_TABS.length - 1;
          if (next < 0) return;
          e.preventDefault();
          onChange(INFLUENCE_TABS[next].id);
          requestAnimationFrame(() => document.getElementById(`influence-tab-${INFLUENCE_TABS[next].id}`)?.focus());
        }}
      >
        {INFLUENCE_TABS.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`influence-tab-${t.id}`}
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              aria-controls="influence-tabpanel"
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
