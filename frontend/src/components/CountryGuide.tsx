// A newcomer who lands on a country page from a link elsewhere (a Pulse card,
// a search result) has none of Pulse's own onboarding context -- this
// consolidates the help text already scattered across this page's panel
// tooltips into one readable explainer, the same role PulseGuide/
// InfluenceGuide/PowerGuide play on their own pages.
const QA: [string, string][] = [
  [
    'Is the "sample duty-stack breakdown" my shipment’s actual rate?',
    'No. It runs the same real math the compliance calculator uses, but against a small, disclosed set of representative HTS headings, not your specific product. Use the calculator directly for an exact answer on your own shipment.',
  ],
  [
    'Why does "export controls" sometimes say nothing is curated?',
    'This app has hand-verified Commerce Country Chart status for only 12 destinations. For every other country, it says so plainly rather than guessing -- an export case involving an uncurated country should be flagged for manual review.',
  ],
  [
    'What does the sanctions count actually measure?',
    'A text match on the free-text address field in OFAC’s and BIS’s own data, not a normalized country code. It’s a reasonable signal, not an exact count -- see the full browsable list for exact hits.',
  ],
  [
    'Why is the currency rate sometimes "Eurozone-wide," not country-specific?',
    'This app only tracks a direct exchange-rate pair where one actually exists. Eurozone countries share the EUR pair rather than each getting an invented one.',
  ],
];

export function CountryGuide() {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="display text-2xl text-ink">A short guide to this page</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          Every number on this page cites its own source and as-of date -- click a panel's "What's this?" link for the specific caveat, or read the common
          questions below. For the site-wide guide (how topic labels work, what counts as a market mover, and so on), see the main Pulse page's Guide tab.
        </p>
      </div>
      <div className="card divide-y divide-hairline">
        {QA.map(([q, a]) => (
          <details key={q} className="group px-4 py-3">
            <summary className="cursor-pointer list-none text-ink [&::-webkit-details-marker]:hidden">
              <span className="mr-2 inline-block text-ink-faint group-open:rotate-90">&rsaquo;</span>
              {q}
            </summary>
            <p className="mt-2 pl-4 text-sm text-ink-muted">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
