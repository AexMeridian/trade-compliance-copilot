import { useEffect, useState } from 'react';
import { getAdcvd, type AdcvdResult } from '../lib/api';

// "Antidumping/countervailing orders may apply: verify". Shown under the duty total in the free tariff lookup and in the calculator report.
// Orders come from the site's own table (loaded from an official export; see src/lib/adcvd.ts), matched by HTS code where the source names
// one and otherwise by product words, and every row says which. When no export is loaded the notice says so plainly: an empty list there
// would read as "no order applies", which is not known.
export function AdcvdNotice({ hts, country, initial }: { hts: string; country: string; initial?: AdcvdResult }) {
  const [res, setRes] = useState<AdcvdResult | null>(initial ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (initial) {
      setRes(initial);
      return;
    }
    let live = true;
    setRes(null);
    setFailed(false);
    getAdcvd(hts, country)
      .then((r) => live && setRes(r))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [hts, country, initial]);

  const search = res?.searchUrl ?? 'https://access.trade.gov/adcvd';
  const link = (
    <a href={search} target="_blank" rel="noreferrer" className="text-accent hover:underline">
      Commerce AD/CVD search (ACCESS)
    </a>
  );

  return (
    <div className="mt-3 border border-review/40 bg-review-soft px-4 py-3" aria-live="polite">
      <p className="text-sm font-semibold text-ink">Antidumping/countervailing orders may apply: verify</p>
      {failed && <p className="mt-1 text-sm text-ink-muted">The order list could not be loaded just now. Check the {link} before you ship.</p>}
      {!failed && !res && <p className="mt-1 text-sm text-ink-muted">Checking orders…</p>}
      {res?.status === 'not_loaded' && (
        <p className="mt-1 text-sm text-ink-muted">
          This site has not loaded a list of orders yet, so it cannot tell you whether one covers this product. Not being shown here does not mean none applies. Search the {link}, and ask a licensed
          customs broker.
        </p>
      )}
      {res?.status === 'ok' && res.matches.length === 0 && (
        <p className="mt-1 text-sm text-ink-muted">
          No loaded order matched this code from this country. That is not proof that none applies: orders are written in words, and this match is conservative. Check the {link}.
        </p>
      )}
      {res?.status === 'ok' && res.matches.length > 0 && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-[13px]">
            <caption className="sr-only">Antidumping and countervailing duty orders that may apply to this product from this country</caption>
            <thead>
              <tr className="border-b border-hairline text-xs text-ink-muted">
                <th scope="col" className="py-1 pr-3 font-semibold">Case</th>
                <th scope="col" className="py-1 pr-3 font-semibold">Product</th>
                <th scope="col" className="py-1 pr-3 font-semibold">Order date</th>
                <th scope="col" className="py-1 pr-3 font-semibold">Deposit rate</th>
                <th scope="col" className="py-1 font-semibold">Match</th>
              </tr>
            </thead>
            <tbody>
              {res.matches.map((m) => (
                <tr key={m.case_number} className="border-b border-hairline/60 align-top">
                  <td className="py-1.5 pr-3 font-mono tabular-nums">
                    <a href={m.source_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      {m.case_number}
                    </a>
                    <span className="block font-sans text-[11px] text-ink-faint">{m.order_type === 'AD' ? 'Antidumping' : 'Countervailing'}, {m.country}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-ink">{m.product}</td>
                  <td className="py-1.5 pr-3 tabular-nums text-ink-muted">{m.order_date ?? 'n/a'}</td>
                  <td className="py-1.5 pr-3 tabular-nums text-ink-muted">
                    {m.rate_min === null && m.rate_max === null ? 'not listed' : m.rate_min === m.rate_max || m.rate_max === null ? `${m.rate_min}%` : `${m.rate_min ?? '?'}% to ${m.rate_max}%`}
                  </td>
                  <td className="py-1.5 text-ink-muted">{m.basis === 'hts' ? 'HTS code' : 'Product words only: confirm'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {res?.status === 'ok' && (
        <p className="mt-2 text-xs text-ink-faint">
          {res.source ?? 'Official export'}, as of {res.asOf ?? 'unknown'}. {res.matches.length > 0 && 'Rates are the published cash-deposit range, not a duty owed: the rate for a given exporter depends on its own review. '}
          Orders are matched by HTS code where the source names one and otherwise by product words, so a match is a lead to verify, not a finding. {link}.
        </p>
      )}
    </div>
  );
}
