import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { CaseFile, Direction, Verdict } from '../types/case';
import { createCase, getReport, listSamples } from '../lib/api';
import { VerdictBanner } from '../components/VerdictBanner';
import { Globe } from '../components/Globe';

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
    n: '01',
    title: 'Classification',
    body: 'The product description is matched against the loaded HTS schedule, ranked by candidate score, and flagged as ambiguous when two headings score within range of each other — rather than silently picking one.',
  },
  {
    n: '02',
    title: 'Origin / USMCA',
    body: 'Component-level origin and value data are run against the applicable General Note 11 rule — tariff shift or regional value content — to produce a qualify/does-not-qualify finding with the threshold math shown.',
  },
  {
    n: '03',
    title: 'Party screening',
    body: 'Buyer, seller, and intermediary names are fuzzy-matched against the OFAC SDN list and the BIS/State Consolidated Screening List, with a written rationale for every candidate, including false positives.',
  },
  {
    n: '04',
    title: 'Determination',
    body: 'Classification, origin, and screening results are combined into a landed-cost duty stack (imports) or a license-requirement path (exports), with open issues called out for a human analyst rather than glossed over.',
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
    <div>
      <section className="mx-auto max-w-xl px-4 pb-2 pt-10 text-center sm:pt-12">
        <h1 className="font-serif text-2xl font-semibold text-ink sm:text-3xl">Compliance calculator</h1>
        <p className="mx-auto mt-3 max-w-sm font-sans text-ink-muted leading-relaxed">
          One more way to use the data behind{' '}
          <Link to="/" className="text-ink underline underline-offset-2 hover:text-accent">
            Trade Policy Pulse
          </Link>
          : run a single shipment through classification, origin, screening, and duty determination.
        </p>

        <div id="start" className="mt-7 flex flex-wrap items-center justify-center gap-2 font-sans">
          {(['import', 'export'] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={`border px-4 py-2 text-sm capitalize transition-colors ${
                direction === d ? 'border-accent bg-accent-soft text-accent' : 'border-hairline text-ink-muted hover:border-hairline-strong'
              }`}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={startNewCase}
            disabled={creating}
            className="border border-accent bg-accent px-4 py-2 text-sm font-semibold text-paper hover:bg-accent/90 disabled:opacity-50"
          >
            {creating ? 'Starting…' : `Start new ${direction} case`}
          </button>
        </div>

        <p className="mx-auto mt-6 max-w-sm font-sans text-xs text-ink-faint">
          Every answer cites primary trade data — HTS, Schedule B, OFAC, BIS, USMCA, ECCN —{' '}
          <a href="#data-sources" className="text-ink-muted underline underline-offset-2 hover:text-ink">
            see the sources
          </a>
          .
        </p>
      </section>

      <div className="mt-8">
        <div className="relative mx-auto w-[380px] h-[250px] overflow-hidden sm:w-[620px] sm:h-[400px] md:w-[820px] md:h-[520px] lg:w-[920px] lg:h-[580px]">
          <div className="absolute inset-x-0 top-0">
            <Globe />
          </div>
        </div>
        <p className="mx-auto mt-3 max-w-sm px-4 text-center font-sans text-xs leading-relaxed text-ink-faint">
          Drag to rotate, scroll to zoom. Real lanes from the sample cases
          below: Los Angeles, the entry port assumed in the duty-stack
          examples, routed to Toronto, Gothenburg, and St. Petersburg.
        </p>

        <dl className="mx-auto mt-10 grid max-w-lg grid-cols-2 gap-x-6 gap-y-4 border-t border-hairline px-4 pt-6 font-sans sm:grid-cols-4">
          {[
            { value: '31,860', label: 'HTS tariff lines' },
            { value: '9,746', label: 'Schedule B lines' },
            { value: '26,146', label: 'Screened party records' },
            { value: '4', label: 'Compliance modules' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <dt className="font-mono text-lg font-semibold text-ink">{s.value}</dt>
              <dd className="mt-0.5 text-xs leading-snug text-ink-muted">{s.label}</dd>
            </div>
          ))}
        </dl>
      </div>

      <section className="mx-auto max-w-3xl border-t border-hairline px-4 py-14">
        <div className="border border-hairline-strong bg-paper-raised">
          <div className="flex items-center justify-between border-b border-hairline px-4 py-2.5">
            <span className="font-sans text-xs text-ink-faint">Live sample output</span>
            {preview && (
              <button
                type="button"
                onClick={() => navigate(`/case/${preview.case_file.id}/report`)}
                className="font-sans text-xs text-accent hover:underline"
              >
                Open full report
              </button>
            )}
          </div>
          {!preview && (
            <div className="p-4 font-sans text-sm text-ink-faint">
              {samples.length === 0 ? (
                'Sample cases aren\'t available right now.'
              ) : (
                'Loading a live sample case…'
              )}
            </div>
          )}
          {preview && (
            <div className="p-4">
              <VerdictBanner verdict={preview.verdict} caseId={preview.case_file.id} />
              <p className="mt-3 font-sans text-xs text-ink-faint">
                {preview.case_file.direction === 'import' ? 'Import' : 'Export'} case, classified as{' '}
                <span className="font-mono">{preview.case_file.classification.selected_code}</span>
              </p>
              {preview.case_file.direction === 'import' && preview.case_file.determination.duty_stack && (
                <table className="mt-4 w-full border-collapse text-xs">
                  <tbody>
                    {preview.case_file.determination.duty_stack.map((line, i) => (
                      <tr key={i} className={`border-t border-hairline ${line.applies ? '' : 'text-ink-faint'}`}>
                        <td className="py-1.5 pr-2 align-top">{line.layer}</td>
                        <td className="py-1.5 pr-2 align-top font-mono">
                          {line.applies ? (line.rate_pct !== null ? `${line.rate_pct}%` : 'unparsed') : '—'}
                        </td>
                        <td className="py-1.5 align-top text-ink-muted">{line.legal_basis}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {preview.case_file.direction === 'export' && (
                <div className="mt-4 space-y-1.5 font-mono text-xs">
                  <div>ECCN: {preview.case_file.determination.eccn ?? 'EAR99 / no match'}</div>
                  <div>License requirement: {preview.case_file.determination.license_requirement ?? 'Unresolved'}</div>
                </div>
              )}
              <p className="mt-4 font-sans text-xs leading-relaxed text-ink-faint">
                This is a real determination produced by the live pipeline against a seeded sample case, not a mockup.
              </p>
            </div>
          )}
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-5xl border-t border-hairline px-4 py-14">
        <h2 className="font-serif text-lg font-semibold text-ink">How a case moves through the system</h2>
        <div className="mt-6 grid gap-x-8 gap-y-8 sm:grid-cols-2">
          {METHOD_STEPS.map((step) => (
            <div key={step.n} className="flex gap-4">
              <span className="font-mono text-sm text-ink-faint">{step.n}</span>
              <div>
                <h3 className="font-serif text-base font-semibold text-ink">{step.title}</h3>
                <p className="mt-1 font-sans text-sm leading-relaxed text-ink-muted">{step.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="data-sources" className="mx-auto max-w-5xl border-t border-hairline px-4 py-14">
        <h2 className="font-serif text-lg font-semibold text-ink">Reference data behind every answer</h2>
        <p className="mt-1.5 max-w-2xl font-sans text-sm text-ink-muted">
          Counts read directly from the production database as of 2026-09-23. Every citation in a case file links back
          to one of these sources with a source tier and an as-of or last-updated date.
        </p>
        <div className="mt-6 divide-y divide-hairline border-y border-hairline">
          {REFERENCE_DATA.map((row) => (
            <div key={row.dataset} className="grid gap-x-6 gap-y-1 py-3.5 sm:grid-cols-[1fr_11rem_1.3fr]">
              <div className="font-sans text-sm font-medium text-ink">{row.dataset}</div>
              <div className="font-mono text-sm text-ink-muted">{row.count}</div>
              <div className="font-sans text-xs leading-relaxed text-ink-faint">
                {row.source}
                <span className="block">{row.note}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="samples" className="mx-auto max-w-5xl px-4 py-14">
        <h2 className="font-serif text-lg font-semibold text-ink">Run a sample case</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {samples.map((s) => {
            const label = SAMPLE_LABELS[s.sample_key];
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(`/case/${s.id}/report`)}
                className="border border-hairline p-4 text-left transition-colors hover:border-accent"
              >
                <div className="font-mono text-xs text-ink-faint">{s.direction}</div>
                <div className="mt-1.5 font-serif text-base font-semibold text-ink">{label?.title ?? s.sample_key}</div>
                <div className="mt-1 font-sans text-sm text-ink-muted">{label?.note ?? s.product_description}</div>
              </button>
            );
          })}
          {samples.length === 0 && (
            <p className="font-sans text-sm text-ink-faint">
              Sample cases aren't available right now.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
