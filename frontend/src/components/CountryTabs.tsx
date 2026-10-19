// Same accessible tab-bar convention as PulseTabs.tsx/SectionTabs.tsx --
// native buttons with tab roles, roving tabindex, arrow-key navigation. Kept
// as its own small file rather than adding a fourth tab-id union to one of
// the existing ones, since this page's sections don't map onto Pulse's or
// Influence's section hues.
export type CountryTabId = 'overview' | 'hard' | 'soft' | 'markets' | 'guide';
// Inside the Hard power tab, the four sections the old tab bar listed separately.
export type HardSectionId = 'policy' | 'tariffs' | 'export' | 'sanctions';

export const COUNTRY_TABS: { id: CountryTabId; label: string; hint: string }[] = [
  { id: 'overview', label: 'Overview', hint: 'The short version' },
  { id: 'hard', label: 'Hard power', hint: 'U.S. policy actions, tariffs, export controls and sanctions that name this country' },
  { id: 'soft', label: 'Soft power', hint: 'Pressure and support toward this country, what people say, and its place among countries on culture, values and aid' },
  { id: 'markets', label: 'Markets & news', hint: 'Currency and recent headlines, if applicable' },
  { id: 'guide', label: 'Guide', hint: 'What each tab means and its real limits, for newcomers' },
];

export const HARD_SECTIONS: { id: HardSectionId; label: string }[] = [
  { id: 'policy', label: 'Policy actions' },
  { id: 'tariffs', label: 'Tariffs & duty stack' },
  { id: 'export', label: 'Export controls' },
  { id: 'sanctions', label: 'Sanctions' },
];

/** Old ?tab= values, which now point inside the Hard power or Soft power tab. */
export const OLD_COUNTRY_TAB: Record<string, { tab: CountryTabId; section?: HardSectionId }> = {
  policy: { tab: 'hard', section: 'policy' },
  tariffs: { tab: 'hard', section: 'tariffs' },
  export: { tab: 'hard', section: 'export' },
  sanctions: { tab: 'hard', section: 'sanctions' },
  influence: { tab: 'soft' },
};

export function CountryTabs({ active, onChange }: { active: CountryTabId; onChange: (id: CountryTabId) => void }) {
  return (
    <div id="country-tabs" className="sticky top-14 z-[9] mt-8 flex scroll-mt-16 bg-paper flex-col gap-3 border-b border-hairline-strong">
      <div
        role="tablist"
        aria-label="Country sections"
        className="flex min-w-0 overflow-x-auto"
        onKeyDown={(e) => {
          const i = COUNTRY_TABS.findIndex((t) => t.id === active);
          let next = -1;
          if (e.key === 'ArrowRight') next = (i + 1) % COUNTRY_TABS.length;
          else if (e.key === 'ArrowLeft') next = (i - 1 + COUNTRY_TABS.length) % COUNTRY_TABS.length;
          else if (e.key === 'Home') next = 0;
          else if (e.key === 'End') next = COUNTRY_TABS.length - 1;
          if (next < 0) return;
          e.preventDefault();
          onChange(COUNTRY_TABS[next].id);
          requestAnimationFrame(() => document.getElementById(`country-tab-${COUNTRY_TABS[next].id}`)?.focus());
        }}
      >
        {COUNTRY_TABS.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`country-tab-${t.id}`}
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              aria-controls="country-tabpanel"
              title={t.hint}
              onClick={() => onChange(t.id)}
              className={`shrink-0 whitespace-nowrap -mb-px px-4 py-2.5 text-[15px] font-semibold ${on ? 'border-b-4 border-ink text-ink' : 'border-b-4 border-transparent text-ink-muted hover:text-ink'}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
