import { useState } from 'react';

// The page's terms, filtered as you type. Every term stays in the page's text, so nothing depends on the filter.
export function GlossarySearch({ terms }: { terms: readonly (readonly [string, string])[] }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = needle ? terms.filter(([t, d]) => t.toLowerCase().includes(needle) || d.toLowerCase().includes(needle)) : terms;
  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search the terms"
        aria-label="Search the terms used on this page"
        className="w-full max-w-xs border border-hairline-strong bg-paper-raised px-2.5 py-1.5 text-[13px]"
      />
      <dl className="mt-3 grid gap-3 text-[13px] text-ink-muted md:grid-cols-2">
        {shown.map(([term, def]) => (
          <div key={term} className="card p-3">
            <dt className="font-semibold text-ink">{term}</dt>
            <dd className="mt-0.5 leading-relaxed">{def}</dd>
          </div>
        ))}
        {shown.length === 0 && <p>No term matches that.</p>}
      </dl>
    </div>
  );
}
