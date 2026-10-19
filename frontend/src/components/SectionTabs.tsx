import type { ReactNode } from 'react';

import type { TabDef } from '../lib/powerTabs';

// The accessible tab bar shared by the Hard Power and Soft Power pages: native buttons with tab roles, roving tabindex and arrow-key
// navigation. The page owns which panel renders; `idPrefix` makes the tab and panel ids unique per page.
export function SectionTabs<T extends string>({
  tabs,
  active,
  onChange,
  idPrefix,
  label,
  children,
}: {
  tabs: TabDef<T>[];
  active: T;
  onChange: (id: T) => void;
  idPrefix: string;
  label: string;
  children?: ReactNode;
}) {
  return (
    <div id={`${idPrefix}-tabs`} className="sticky top-14 z-[9] mt-8 flex scroll-mt-16 flex-col gap-3 bg-paper sm:flex-row sm:items-end sm:border-b sm:border-hairline-strong">
      <div
        role="tablist"
        aria-label={label}
        className="flex min-w-0 overflow-x-auto border-b border-hairline-strong sm:border-b-0"
        onKeyDown={(e) => {
          const i = tabs.findIndex((t) => t.id === active);
          let next = -1;
          if (e.key === 'ArrowRight') next = (i + 1) % tabs.length;
          else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length;
          else if (e.key === 'Home') next = 0;
          else if (e.key === 'End') next = tabs.length - 1;
          if (next < 0) return;
          e.preventDefault();
          onChange(tabs[next].id);
          requestAnimationFrame(() => document.getElementById(`${idPrefix}-tab-${tabs[next].id}`)?.focus());
        }}
      >
        {tabs.map((t) => {
          const on = t.id === active;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${t.id}`}
              aria-selected={on}
              tabIndex={on ? 0 : -1}
              aria-controls={`${idPrefix}-tabpanel`}
              title={t.hint}
              onClick={() => onChange(t.id)}
              className={`-mb-px shrink-0 whitespace-nowrap px-4 py-2.5 text-[15px] font-semibold ${on ? `border-b-4 ${t.border ?? 'border-ink'} text-ink` : 'border-b-4 border-transparent text-ink-muted hover:text-ink'}`}
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
