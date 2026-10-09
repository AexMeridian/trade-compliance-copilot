import { SECTION_HUE } from '../lib/pulseColors';

export type PowerTabId = 'overview' | 'hard' | 'soft' | 'alliances' | 'guide';

export const POWER_TABS: { id: PowerTabId; label: string; hint: string }[] = [
  { id: 'overview', label: 'Overview', hint: 'The short version' },
  { id: 'hard', label: 'Trade tools', hint: 'Tariffs, sanctions and export controls the U.S. is using' },
  { id: 'soft', label: 'Dollar & diplomacy', hint: "The dollar's reach and reserve-currency status, and diplomatic headlines" },
  { id: 'alliances', label: 'Alliances', hint: 'Which countries belong to NATO, G7, G20, BRICS and USMCA, and recent U.S. measures naming them' },
  { id: 'guide', label: 'Guide', hint: 'What these sections show, where the data comes from, and their limits' },
];

// Same accessible tab-bar idiom as PulseTabs/InfluenceTabs, over a third,
// Power-specific tab list -- reusing the same section hues Influence already
// established for "pressure" (hard power) and "reach" (soft power), since
// these are literally the same underlying data reframed, not a new taxonomy.
const TAB_BORDER: Record<PowerTabId, string> = {
  overview: 'border-ink',
  hard: SECTION_HUE.policy.border,
  soft: SECTION_HUE.markets.border,
  alliances: 'border-hue-pink',
  guide: 'border-ink',
};

export function PowerTabs({ active, onChange }: { active: PowerTabId; onChange: (id: PowerTabId) => void }) {
  return (
    <div id="power-tabs" className="mt-8 flex scroll-mt-16 flex-col gap-3 sm:flex-row sm:items-end sm:border-b sm:border-hairline-strong">
      <div
        role="tablist"
        aria-label="Dollar and allies sections"
        className="flex min-w-0 overflow-x-auto border-b border-hairline-strong sm:border-b-0"
        onKeyDown={(e) => {
          const i = POWER_TABS.findIndex((t) => t.id === active);
          let next = -1;
          if (e.key === 'ArrowRight') next = (i + 1) % POWER_TABS.length;
          else if (e.key === 'ArrowLeft') next = (i - 1 + POWER_TABS.length) % POWER_TABS.length;
          else if (e.key === 'Home') next = 0;
          else if (e.key === 'End') next = POWER_TABS.length - 1;
          if (next < 0) return;
          e.preventDefault();
          onChange(POWER_TABS[next].id);
          requestAnimationFrame(() => document.getElementById(`power-tab-${POWER_TABS[next].id}`)?.focus());
        }}
      >
        {POWER_TABS.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`power-tab-${t.id}`}
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              aria-controls="power-tabpanel"
              title={t.hint}
              onClick={() => onChange(t.id)}
              className={`shrink-0 whitespace-nowrap -mb-px px-4 py-2.5 text-[15px] font-semibold ${on ? `border-b-4 ${TAB_BORDER[t.id]} text-ink` : 'border-b-4 border-transparent text-ink-muted hover:text-ink'}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
