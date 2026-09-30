import { useEffect, useState } from 'react';
import { getPulseTariffs, type TariffOverlayRow } from '../lib/api';
import { TARIFF_COUNTRY_LABELS } from '../lib/pulseTariffCountries';

const PAGE_SIZE = 25;

const PROGRAM_LABEL: Record<string, string> = {
  sec232_steel: 'Section 232 (steel)',
  sec232_aluminum: 'Section 232 (aluminum)',
  sec232_copper: 'Section 232 (copper)',
  sec232_autos: 'Section 232 (autos)',
  sec232_autos_parts: 'Section 232 (auto parts)',
  sec232_metals_country_cap: 'Section 232 (country cap)',
  sec301_forced_labor: 'Section 301 (forced labor)',
  sec338_canada: 'Section 338 (Canada)',
};

// The full tariff_overlays table, one row per (program, HTS pattern, country
// scope) -- everywhere else on this page shows a rollup of this data
// (/active-measures groups by program, /summary's countryTariffs picks three
// slices). This is the underlying grain, for anyone who wants to check a
// specific rate rather than trust a summary.
export function PulseTariffBrowser() {
  const [program, setProgram] = useState('');
  const [programs, setPrograms] = useState<string[]>([]);
  const [rows, setRows] = useState<TariffOverlayRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPulseTariffs({ program: program || undefined, limit: PAGE_SIZE, offset: page * PAGE_SIZE })
      .then((data) => {
        setRows(data.rows);
        setTotal(data.total);
        setPrograms(data.programs);
      })
      .finally(() => setLoading(false));
  }, [program, page]);

  const pages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="text-xs font-semibold text-ink-muted" htmlFor="tariff-program-filter">
          Program
        </label>
        <select
          id="tariff-program-filter"
          value={program}
          onChange={(e) => {
            setProgram(e.target.value);
            setPage(0);
          }}
          className="rounded border border-hairline-strong bg-paper-raised px-2 py-1 text-sm text-ink"
        >
          <option value="">All programs</option>
          {programs.map((p) => (
            <option key={p} value={p}>
              {PROGRAM_LABEL[p] ?? p}
            </option>
          ))}
        </select>
        <span className="text-xs text-ink-faint">{total} rows</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline-strong text-left text-ink-muted">
              <th className="py-1.5 pr-3 font-normal">Program</th>
              <th className="py-1.5 pr-3 font-normal">HTS pattern</th>
              <th className="py-1.5 pr-3 font-normal">Country</th>
              <th className="py-1.5 pr-3 font-normal">Rate</th>
              <th className="py-1.5 pr-3 font-normal">Effective</th>
              <th className="py-1.5 font-normal">Source</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-ink-faint">
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-ink-faint">
                  No rows match this filter.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr key={i} className="border-b border-hairline">
                  <td className="py-2 pr-3">{PROGRAM_LABEL[r.program] ?? r.program}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.hts_pattern}</td>
                  <td className="py-2 pr-3">{r.country_scope ? (TARIFF_COUNTRY_LABELS[r.country_scope] ?? r.country_scope) : 'All countries'}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.rate_pct !== null ? `${r.rate_pct}%` : '—'}</td>
                  <td className="py-2 pr-3 tabular-nums">
                    {r.effective_date}
                    {r.expiration_date ? ` – ${r.expiration_date}` : ''}
                  </td>
                  <td className="py-2">
                    <a href={r.source_url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      Tier {r.source_tier}
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
