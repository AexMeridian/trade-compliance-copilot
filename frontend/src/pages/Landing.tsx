import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CaseFile, Direction, Verdict } from '../types/case';
import { createCase, getReport, listSamples } from '../lib/api';
import { VerdictBanner } from '../components/VerdictBanner';

const SAMPLE_LABELS: Record<string, { title: string; note: string }> = {
  'ambiguous-classification': {
    title: 'Ambiguous classification',
    note: 'A product description that plausibly fits two HTS headings.',
  },
  'canada-usmca-338': {
    title: 'Canada import: clears USMCA, still hits Section 338',
    note: 'Qualifies for preferential origin, but a separate tariff overlay still applies.',
  },
  'export-license-required': {
    title: 'Export with a real license requirement',
    note: 'Self-classifies to a controlled ECCN with a matching country-chart reason.',
  },
  'clean-pass': {
    title: 'Clean pass',
    note: 'Everything clears: classification, origin, screening, and determination.',
  },
};

const REFERENCE_DATA = [
  {
    dataset: 'Harmonized Tariff Schedule',
    count: '31,860 tariff lines',
    source: 'U.S. International Trade Commission',
    note: 'Full 8/10-digit US import schedule, general and special (USMCA) rate columns.',
  },
  {
    dataset: 'Schedule B export codes',
    count: '9,746 lines',
    source: 'U.S. Census Bureau, Foreign Trade Division',
    note: 'Cross-referenced against HTS on every classification for import/export symmetry.',
  },
  {
    dataset: 'Denied- and restricted-party lists',
    count: '26,146 screened records',
    source: 'OFAC Specially Designated Nationals List + BIS/State Consolidated Screening List',
    note: 'Fuzzy name matching with a documented false-positive rationale on every candidate.',
  },
  {
    dataset: 'USMCA rules of origin',
    count: 'Curated rule set',
    source: 'General Note 11, HTSUS',
    note: 'Tariff-shift and regional-value-content thresholds by HS chapter.',
  },
  {
    dataset: 'Export control classifications',
    count: 'Curated ECCN set',
    source: 'BIS Commerce Control List',
    note: 'Reasons-for-control and country-chart license determinations.',
  },
];

const METHOD_STEPS = [
  {
    title: 'Classification',
    body: 'The product description is matched against the loaded HTS schedule, ranked by candidate score, and flagged as ambiguous when two headings score close to each other, so it never silently picks one.',
  },
  {
    title: 'Origin / USMCA',
    body: 'Component-level origin and value data are run against the applicable General Note 11 rule (tariff shift or regional value content) to produce a qualifies or does-not-qualify finding with the threshold math shown.',
  },
  {
    title: 'Party screening',
    body: 'Buyer, seller, and intermediary names are fuzzy-matched against the OFAC SDN list and the BIS/State Consolidated Screening List, with a written rationale for every candidate, including the false positives.',
  },
  {
    title: 'Determination',
    body: 'Classification, origin, and screening results are combined into a landed-cost duty stack (imports) or a license-requirement path (exports), with open issues listed for a human analyst to review.',
  },
];

export function Landing() {
  const [direction, setDirection] = useState<Direction>('import');
  const [samples, setSamples] = useState<{ id: string; direction: Direction; sample_key: string; product_description: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [preview, setPreview] = useState<{ case_file: CaseFile; verdict: Verdict } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    listSamples()
      .then((r) => setSamples(r.samples))
      .catch(() => setSamples([]));
  }, []);

  useEffect(() => {
    if (samples.length === 0) return;
    const preferred = samples.find((s) => s.sample_key === 'canada-usmca-338') ?? samples.find((s) => s.direction === 'import') ?? samples[0];
    if (!preferred) return;
    getReport(preferred.id)
      .then((r) => setPreview({ case_file: r.case_file, verdict: r.verdict }))
      .catch(() => setPreview(null));
  }, [samples]);

  async function startNewCase() {
    setCreating(true);
    try {
      const { id } = await createCase(direction);
      navigate(`/case/${id}`);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-10">
      <section id="start">
        <h1 className="display text-4xl text-ink">Compliance calculator</h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-ink-muted">
          Run a single shipment through classification, origin, party screening and duty determination. It uses the same trade data as{' '}
          <Link to="/" className="text-accent hover:underline">
            Trade Policy Pulse
          </Link>
          , and every answer cites its source.
        </p>

        <div className="card mt-6 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div role="group" aria-label="Shipment direction" className="inline-flex bg-paper p-1 ring-1 ring-inset ring-hairline">
            {(['import', 'export'] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                aria-pressed={direction === d}
                className={`px-4 py-1.5 text-sm capitalize ${direction === d ? 'bg-paper-raised font-medium text-ink ring-1 ring-hairline' : 'text-ink-muted hover:text-ink'}`}
              >
                {d}
              </button>
            ))}
          </div>
          <button type="button" onClick={startNewCase} disabled={creating} className="btn-primary">
            {creating ? 'Starting…' : `Start an ${direction} case`}
          </button>
        </div>
        <p className="mt-3 text-[13px] text-ink-faint">
          Sources include the HTS, Schedule B, OFAC, BIS, USMCA rules and the Commerce Control List.{' '}
          <a href="#data-sources" className="text-accent hover:underline">
            See the full list
          </a>
          .
        </p>
      </section>

      <section id="samples" className="mt-14">
        <h2 className="display text-2xl text-ink">Try a sample case</h2>
        <p className="mt-1 text-sm text-ink-muted">Each one opens a finished report so you can see what the output looks like.</p>
        <ul className="card mt-4 divide-y divide-hairline">
          {samples.map((s) => {
            const label = SAMPLE_LABELS[s.sample_key];
            return (
              <li key={s.id}>
                <button type="button" onClick={() => navigate(`/case/${s.id}/report`)} className="block w-full px-4 py-3 text-left hover:bg-paper">
                  <span className="text-[15px] font-medium text-ink">{label?.title ?? s.sample_key}</span>
                  <span className="ml-2 text-xs capitalize text-ink-faint">{s.direction}</span>
                  <span className="mt-0.5 block text-sm text-ink-muted">{label?.note ?? s.product_description}</span>
                </button>
              </li>
            );
          })}
          {samples.length === 0 && <li className="px-4 py-3 text-sm text-ink-faint">Sample cases aren't available right now.</li>}
        </ul>
      </section>

      <section className="mt-14">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="display text-2xl text-ink">Example result</h2>
          {preview && (
            <button type="button" onClick={() => navigate(`/case/${preview.case_file.id}/report`)} className="text-[13px] text-accent hover:underline">
              Open the full report
            </button>
          )}
        </div>
        <div className="card mt-4 p-4">
          {!preview && <p className="text-sm text-ink-faint">{samples.length === 0 ? "Sample cases aren't available right now." : 'Loading a sample case…'}</p>}
          {preview && (
            <>
              <VerdictBanner verdict={preview.verdict} caseId={preview.case_file.id} />
              <p className="mt-3 text-[13px] text-ink-faint">
                {preview.case_file.direction === 'import' ? 'Import' : 'Export'} case, classified as{' '}
                <span className="tabular-nums">{preview.case_file.classification.selected_code}</span>
              </p>
              {preview.case_file.direction === 'import' && preview.case_file.determination.duty_stack && (
                <table className="mt-4 w-full border-collapse text-[13px]">
                  <tbody>
                    {preview.case_file.determination.duty_stack.map((line, i) => (
                      <tr key={i} className={`border-t border-hairline ${line.applies ? '' : 'text-ink-faint'}`}>
                        <td className="py-2 pr-3 align-top">{line.layer}</td>
                        <td className="py-2 pr-3 align-top tabular-nums">{line.applies ? (line.rate_pct !== null ? `${line.rate_pct}%` : 'unparsed') : '-'}</td>
                        <td className="py-2 align-top text-ink-muted">{line.legal_basis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {preview.case_file.direction === 'export' && (
                <div className="mt-4 space-y-1.5 text-[13px] tabular-nums">
                  <div>ECCN: {preview.case_file.determination.eccn ?? 'EAR99 / no match'}</div>
                  <div>License requirement: {preview.case_file.determination.license_requirement ?? 'Unresolved'}</div>
                </div>
              )}
              <p className="mt-4 text-xs leading-relaxed text-ink-faint">This is a real determination from the live pipeline for a seeded sample case.</p>
            </>
          )}
        </div>
      </section>

      <section id="how-it-works" className="mt-14">
        <h2 className="display text-2xl text-ink">How a case works</h2>
        <ol className="mt-5 flex flex-col gap-5">
          {METHOD_STEPS.map((step, i) => (
            <li key={step.title} className="flex gap-4">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-paper-raised text-xs font-medium text-ink-muted ring-1 ring-inset ring-hairline-strong">
                {i + 1}
              </span>
              <div>
                <h3 className="text-[15px] font-semibold text-ink">{step.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-ink-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section id="data-sources" className="mt-14">
        <h2 className="display text-2xl text-ink">Reference data</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-muted">
          Counts are from the production database as of 2026-09-23. Every citation in a case links back to one of these sources with a source tier and an as-of
          date.
        </p>
        <div className="card mt-4 divide-y divide-hairline">
          {REFERENCE_DATA.map((row) => (
            <div key={row.dataset} className="grid gap-x-6 gap-y-1 px-4 py-3 sm:grid-cols-[1fr_11rem_1.3fr]">
              <div className="text-sm font-medium text-ink">{row.dataset}</div>
              <div className="text-sm tabular-nums text-ink-muted">{row.count}</div>
              <div className="text-[13px] leading-relaxed text-ink-faint">
                {row.source}
                <span className="block">{row.note}</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
