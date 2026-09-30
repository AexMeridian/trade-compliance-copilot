import { useEffect, useState } from 'react';
import { getPulseExportControlChart, type ExportChartCoverageRow, type ExportChartRow } from '../lib/api';

const STATUS_LABEL: Record<string, string> = {
  curated: 'Verified',
  comprehensive_embargo: 'Comprehensive embargo',
  broad_restriction_746_5: 'Near-comprehensive restriction',
};

// The full Commerce Country Chart curation this app has -- deliberately
// partial (see country_chart's own migration comment: an automated fetch
// produced internally inconsistent results and was discarded rather than
// trusted). Rendered in full, not paginated, because it's small enough that
// hiding any of it behind pages would just make the "only 12 of ~195" gap
// harder to see.
export function PulseExportChart() {
  const [rows, setRows] = useState<ExportChartRow[]>([]);
  const [coverage, setCoverage] = useState<ExportChartCoverageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPulseExportControlChart()
      .then((data) => {
        setRows(data.rows);
        setCoverage(data.coverage);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-ink-faint">Loading…</p>;

  return (
    <div>
      <p className="mb-4 border border-hairline-strong bg-paper px-3 py-2 text-sm text-ink-muted">
        {coverage.length} destinations hand-verified out of roughly 195 the full Commerce Country Chart covers. Every other destination is intentionally left
        blank rather than guessed -- see each country's page for what "not curated" means there.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-hairline-strong text-left text-ink-muted">
              <th className="py-1.5 pr-3 font-normal">Country</th>
              <th className="py-1.5 pr-3 font-normal">Status</th>
              <th className="py-1.5 font-normal">Detail</th>
            </tr>
          </thead>
          <tbody>
            {coverage.map((c) => {
              const chartRows = rows.filter((r) => r.country_code === c.country_code);
              return (
                <tr key={c.country_code} className="border-b border-hairline align-top">
                  <td className="py-2 pr-3 font-semibold text-ink">{c.country_name}</td>
                  <td className="py-2 pr-3">{STATUS_LABEL[c.status] ?? c.status}</td>
                  <td className="py-2 text-ink-muted">
                    {chartRows.length > 0 ? chartRows.map((r) => r.control_level).join('; ') : c.notes}
                    <a href={c.source_url} target="_blank" rel="noreferrer" className="ml-2 text-accent hover:underline">
                      Source
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
