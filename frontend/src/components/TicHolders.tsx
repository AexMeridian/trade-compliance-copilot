import type { TicHolders as TicData } from '../lib/api';
import { ChartFooter } from './ChartFooter';

const money = (b: number) => (b >= 1000 ? `$${(b / 1000).toFixed(2)} trillion` : `$${b.toFixed(0)} billion`);

// Who owns U.S. government debt: the Treasury's own monthly table of the largest foreign holders, as bars on a shared
// scale with the change from a year earlier. Real figures only; "All Other" and countries the table does not name are
// left out rather than estimated.
export function TicHolders({ data }: { data: TicData }) {
  const rows = data.countries.slice(0, 12);
  if (rows.length === 0) return <p className="text-sm text-ink-faint">Not available right now.</p>;
  const max = Math.max(...rows.map((r) => r.billions));
  const asOf = data.total?.asOf ?? rows[0].asOf;
  return (
    <div>
      {data.total && (
        <p className="text-sm text-ink-muted">
          Foreign holders own <span className="font-semibold text-ink">{money(data.total.billions)}</span> of U.S. Treasury securities
          {data.official ? <>, of which {money(data.official.billions)} is held by foreign governments and central banks</> : null}.
        </p>
      )}
      <table className="mt-3 w-full text-sm">
        <caption className="sr-only">Largest foreign holders of U.S. Treasury securities, billions of dollars</caption>
        <thead className="text-left text-[12px] text-ink-faint">
          <tr>
            <th scope="col" className="py-1 pr-3 font-semibold">Holder</th>
            <th scope="col" className="py-1 pr-3 font-semibold">Holdings</th>
            <th scope="col" className="py-1 text-right font-semibold">Vs. a year ago</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const change = r.yearAgoBillions ? r.billions - r.yearAgoBillions : null;
            return (
              <tr key={r.id} className="border-t border-hairline align-middle">
                <td className="whitespace-nowrap py-1.5 pr-3 text-ink">{r.label}</td>
                <td className="w-full py-1.5 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="h-2 rounded-sm bg-accent" style={{ width: `${Math.max(2, (r.billions / max) * 70)}%` }} aria-hidden="true" />
                    <span className="tabular-nums text-ink-muted">${r.billions.toFixed(0)}B</span>
                  </div>
                </td>
                <td className="whitespace-nowrap py-1.5 text-right tabular-nums text-ink-muted">
                  {change === null ? 'n/a' : `${change >= 0 ? '+' : '−'}$${Math.abs(change).toFixed(0)}B`}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <ChartFooter
        source="U.S. Treasury, Treasury International Capital (TIC)"
        sourceUrl={data.sourceUrl}
        asOf={asOf}
        csv={{
          filename: `foreign-holders-us-treasuries-${asOf}`,
          header: ['Holder', 'Month', 'Billions of USD', 'Billions a year earlier'],
          rows: data.countries.map((r) => [r.label, r.asOf, r.billions, r.yearAgoBillions ?? '']),
        }}
      />
    </div>
  );
}
