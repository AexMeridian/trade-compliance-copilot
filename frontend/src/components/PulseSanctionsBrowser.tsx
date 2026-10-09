import { useEffect, useState } from 'react';
import { downloadCsv } from '../lib/downloadCsv';
import { getPulseSanctions, type SanctionRow } from '../lib/api';

const PAGE_SIZE = 20;

// A country-filterable browser over OFAC's Specially Designated Nationals
// list and the Commerce/State Consolidated Screening List -- these are used
// everywhere else in the app only per name-match (the compliance
// calculator's screening step) or as a single count (the country page's
// Sanctions tab). This is the first place either list is actually browsable.
export function PulseSanctionsBrowser({ initialCountry = '' }: { initialCountry?: string }) {
  const [country, setCountry] = useState(initialCountry);
  const [countryInput, setCountryInput] = useState(initialCountry);
  const [list, setList] = useState<'' | 'sdn' | 'csl'>('');
  const [rows, setRows] = useState<{ sdn: SanctionRow[]; csl: SanctionRow[] }>({ sdn: [], csl: [] });
  const [totals, setTotals] = useState({ sdn: 0, csl: 0 });
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');

  useEffect(() => {
    setLoading(true);
    getPulseSanctions({ country: country || undefined, list: list || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((data) => {
        setRows({ sdn: data.sdn.rows, csl: data.csl.rows });
        setTotals({ sdn: data.sdn.total, csl: data.csl.total });
        setNote(data.note);
      })
      .finally(() => setLoading(false));
  }, [country, list, page]);

  const total = totals.sdn + totals.csl;
  // Page count comes straight from the fetched totals (whichever list needs
  // more pages), not from the current page's own row counts -- deriving it
  // from `rows.x.length` broke whenever a page legitimately came back with
  // zero rows for one list, collapsing the page count to 1 regardless of the
  // real total.
  const pages = Math.max(Math.ceil(Math.max(totals.sdn, totals.csl) / PAGE_SIZE), 1);
  const combined = [...rows.sdn, ...rows.csl];

  return (
    <div>
      <form
        className="mb-3 flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setCountry(countryInput.trim());
          setPage(0);
        }}
      >
        <div>
          <label className="block text-xs font-semibold text-ink-muted" htmlFor="sanctions-country-filter">
            Country name
          </label>
          <input
            id="sanctions-country-filter"
            type="text"
            value={countryInput}
            onChange={(e) => setCountryInput(e.target.value)}
            placeholder="e.g. Russia"
            className="mt-1 rounded border border-hairline-strong bg-paper-raised px-2 py-1 text-sm text-ink"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-muted" htmlFor="sanctions-list-filter">
            List
          </label>
          <select
            id="sanctions-list-filter"
            value={list}
            onChange={(e) => {
              setList(e.target.value as '' | 'sdn' | 'csl');
              setPage(0);
            }}
            className="mt-1 rounded border border-hairline-strong bg-paper-raised px-2 py-1 text-sm text-ink"
          >
            <option value="">SDN and CSL</option>
            <option value="sdn">SDN only</option>
            <option value="csl">CSL only</option>
          </select>
        </div>
        <button type="submit" className="rounded bg-ink px-3 py-1.5 text-sm font-semibold text-paper">
          Search
        </button>
        {country && (
          <button
            type="button"
            onClick={() => {
              setCountry('');
              setCountryInput('');
              setPage(0);
            }}
            className="text-sm text-accent hover:underline"
          >
            Clear
          </button>
        )}
        <button
          type="button"
          disabled={combined.length === 0}
          onClick={() =>
            downloadCsv(
              `sanctions-${country ? country.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'all'}-page-${page + 1}.csv`,
              ['List', 'Name', 'Program or list', 'Source URL'],
              combined.map((r) => [r.list, r.name, r.list === 'SDN' ? r.programs : r.source_list, r.source_url])
            )
          }
          className="text-sm text-accent hover:underline disabled:pointer-events-none disabled:text-ink-faint disabled:no-underline"
        >
          Download this page (CSV)
        </button>
        <span className="ml-auto text-xs text-ink-faint">{total} matching entries</span>
      </form>
      <p className="mb-3 text-xs text-ink-faint">{note}</p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline-strong text-left text-ink-muted">
              <th className="py-1.5 pr-3 font-normal">List</th>
              <th className="py-1.5 pr-3 font-normal">Name</th>
              <th className="py-1.5 pr-3 font-normal">Program / list</th>
              <th className="py-1.5 font-normal">Source</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-ink-faint">
                  Loading…
                </td>
              </tr>
            ) : combined.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-ink-faint">
                  No entries match this filter.
                </td>
              </tr>
            ) : (
              combined.map((r) => (
                <tr key={`${r.list}-${r.id}`} className="border-b border-hairline align-top">
                  <td className="py-2 pr-3">{r.list}</td>
                  <td className="py-2 pr-3">{r.name}</td>
                  <td className="py-2 pr-3 text-ink-muted">{r.list === 'SDN' ? r.programs : r.source_list}</td>
                  <td className="py-2">
                    <a href={r.source_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      Source
                    </a>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-3 flex items-center gap-3 text-sm">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(p - 1, 0))}
            disabled={page === 0}
            className="font-semibold text-accent hover:underline disabled:pointer-events-none disabled:text-ink-faint disabled:no-underline"
          >
            Previous
          </button>
          <span className="text-ink-faint">
            Page {page + 1} of {pages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(p + 1, pages - 1))}
            disabled={page >= pages - 1}
            className="font-semibold text-accent hover:underline disabled:pointer-events-none disabled:text-ink-faint disabled:no-underline"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
