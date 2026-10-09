// A segmented control for choosing which measure a page's top section shows. Same accessible
// tab idiom as the page tab bars (arrow keys move and select, Home/End jump); on a phone the
// row scrolls sideways instead of wrapping.
export function MeasureSwitcher<T extends string>({
  measures,
  active,
  onChange,
  label,
}: {
  measures: { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      onKeyDown={(e) => {
        const i = measures.findIndex((m) => m.id === active);
        let next = i;
        if (e.key === 'ArrowRight') next = (i + 1) % measures.length;
        else if (e.key === 'ArrowLeft') next = (i - 1 + measures.length) % measures.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = measures.length - 1;
        else return;
        e.preventDefault();
        onChange(measures[next].id);
        requestAnimationFrame(() => document.getElementById(`measure-tab-${measures[next].id}`)?.focus());
      }}
    >
      {measures.map((m) => {
        const on = m.id === active;
        return (
          <button
            key={m.id}
            id={`measure-tab-${m.id}`}
            role="tab"
            type="button"
            aria-selected={on}
            aria-controls="measure-panel"
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(m.id)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-[13px] font-semibold ${
              on ? 'border-hero-btn-bg bg-hero-btn-bg text-hero-btn-text' : 'border-hero-border text-hero-ink hover:border-hero-border-strong hover:bg-hero-card-bg'
            }`}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}
