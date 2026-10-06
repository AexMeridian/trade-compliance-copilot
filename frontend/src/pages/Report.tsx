import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { CaseFile, Verdict } from '../types/case';
import { getReport, submitScreening } from '../lib/api';
import { VerdictBanner } from '../components/VerdictBanner';
import { DutyStackTable } from '../components/DutyStackTable';
import { LicensePath } from '../components/LicensePath';
import { ReasoningPanel } from '../components/ReasoningPanel';
import { ScreeningRedFlags } from '../components/ScreeningRedFlags';
import { agoText } from '../lib/pulsePlain';
import { SITE } from '../lib/site';

const SCREENING_PLAIN = { none: 'No matches', caution: 'Needs a closer look', hard_stop: 'Blocked party found' } as const;

export function Report() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ case_file: CaseFile; verdict: Verdict; generated_at: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rescreening, setRescreening] = useState(false);

  useEffect(() => {
    if (!id) return;
    getReport(id)
      .then(setData)
      .catch((e) => setLoadError((e as Error).message));
  }, [id]);

  async function handleRescreen() {
    if (!id || !data) return;
    setRescreening(true);
    try {
      const parties = data.case_file.screening.parties.map((p) => ({ role: p.role, name: p.input_name }));
      const { screening } = await submitScreening(id, parties, data.case_file.screening.deemed_export_flagged);
      setData({ ...data, case_file: { ...data.case_file, screening } });
    } catch {
      // A failed re-screen leaves the existing (still-labeled, still-dated)
      // result in place rather than clearing it -- a stale result the reader
      // can see is stale is better than silently losing it.
    } finally {
      setRescreening(false);
    }
  }

  if (!id || loadError) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="border border-stop/30 bg-stop-soft px-3 py-2 text-sm text-stop">
          {loadError ? `Couldn't load this report. (${loadError})` : 'No report selected.'}
        </p>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <p className="card py-6 text-center text-sm text-ink-faint">Loading report…</p>
      </div>
    );
  }

  const { case_file: cf, verdict, generated_at } = data;

  // One line per module, in plain words, so the answer is visible without
  // reading the reasoning below it.
  const det = cf.determination;
  const dutyValue =
    cf.direction === 'import'
      ? det.landed_cost_estimate_pct !== null
        ? `${det.landed_cost_estimate_pct}% duty`
        : 'Needs manual calculation'
      : (det.license_requirement ?? 'Not determined');
  const glance = [
    { label: 'Product code', value: cf.classification.selected_code ?? 'Not resolved' },
    { label: 'USMCA origin', value: cf.direction === 'import' ? (cf.origin.qualifies === null ? 'Undetermined' : cf.origin.qualifies ? 'Qualifies' : 'Does not qualify') : 'Not applicable' },
    { label: 'Party screening', value: SCREENING_PLAIN[cf.screening.highest_severity] },
    { label: cf.direction === 'import' ? 'Estimated duty' : 'Export license', value: dutyValue },
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {/* Screen-only: the printed/PDF copy names the site in its own
          print-only header below instead, since the site's live header
          (with its nav links) is hidden for print. */}
      <div className="no-print mb-4 flex justify-end">
        <button type="button" onClick={() => window.print()} className="btn text-sm">
          Print or save as PDF
        </button>
      </div>
      {/* Print-only: window.print()'s own header/footer already add a page
          title and URL in most browsers, but this makes the case identity
          and as-of date part of the document itself, not just the chrome
          around it (which a reader may trim when saving to PDF). */}
      <div className="mb-4 hidden border-b border-hairline pb-3 print:block">
        <p className="font-display text-lg font-bold text-ink">{SITE.name} -- compliance case</p>
        <p className="text-xs text-ink-faint">
          Case {cf.id}, printed {new Date().toLocaleString()}. Not legal, customs, tax or financial advice -- see the disclaimer at the end of this document.
        </p>
      </div>
      <VerdictBanner verdict={verdict} caseId={cf.id} generatedAt={generated_at} issues={cf.open_issues} />

      <dl className="mt-4 grid grid-cols-2 gap-px border border-hairline bg-hairline text-sm sm:grid-cols-4">
        {glance.map((g) => (
          <div key={g.label} className="bg-paper px-3 py-2">
            <dt className="text-xs text-ink-faint">{g.label}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-ink">{g.value}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-8 border-t border-hairline pt-6">
        <h2 className="font-display text-xl font-bold text-ink">1. Classification</h2>
        <p className="mt-1 tabular-nums text-sm">{cf.classification.selected_code ?? 'Not resolved'}</p>
        <p className="text-sm text-ink-muted">{cf.classification.reasoning?.summary}</p>
        {cf.classification.reasoning && <ReasoningPanel reasoning={cf.classification.reasoning} />}
      </section>

      <section className="mt-8 border-t border-hairline pt-6">
        <h2 className="font-display text-xl font-bold text-ink">2. Origin</h2>
        <p className="mt-1 text-sm">
          {cf.origin.qualifies === null ? 'Indeterminate' : cf.origin.qualifies ? 'Qualifies for USMCA' : 'Does not qualify for USMCA'}
        </p>
        <p className="text-sm text-ink-muted">{cf.origin.reasoning?.summary}</p>
        {cf.origin.reasoning && <ReasoningPanel reasoning={cf.origin.reasoning} />}
      </section>

      <section className="mt-8 border-t border-hairline pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h2 className="font-display text-xl font-bold text-ink">3. Screening</h2>
          <button type="button" onClick={handleRescreen} disabled={rescreening} className="no-print btn text-xs">
            {rescreening ? 'Re-screening…' : 'Re-screen parties'}
          </button>
        </div>
        <p className="mt-1 text-sm">{SCREENING_PLAIN[cf.screening.highest_severity]}</p>
        {cf.screening.screened_at && (
          <p className="text-xs text-ink-faint">
            Screened {agoText(cf.screening.screened_at)}. Watchlists change over time -- re-screen before acting on a result from a while ago.
          </p>
        )}
        {cf.screening.parties.map((p, i) => (
          <div key={i} className="mt-3">
            <div className="text-sm font-semibold text-ink">
              {p.role}: {p.input_name}
            </div>
            {p.matches.length === 0 && <div className="text-sm text-ink-faint">No candidate matches above threshold.</div>}
            {p.matches.map((m, j) => (
              <div key={j} className="mt-1 border-l-2 border-hairline-strong pl-3">
                <div className="text-sm">
                  <span className="tabular-nums">{m.matched_name}</span>{' '}
                  <span className={m.verdict === 'true_match' ? 'text-stop' : m.verdict === 'inconclusive' ? 'text-review' : 'text-ink-faint'}>
                    {m.verdict.replace('_', ' ')}
                  </span>{' '}
                  <span className="text-ink-faint">
                    ({m.matched_list}, score {m.match_score.toFixed(2)})
                  </span>
                </div>
                {m.token_sort_score !== undefined && m.jaro_winkler_score !== undefined && (
                  <div className="text-xs text-ink-faint">
                    Matched on {m.matched_via === 'alias' ? 'an alias' : 'the primary name'} -- token-sort {m.token_sort_score.toFixed(2)}, Jaro-Winkler{' '}
                    {m.jaro_winkler_score.toFixed(2)}.
                  </div>
                )}
                <div className="text-sm text-ink-muted">{m.risk_memo}</div>
              </div>
            ))}
          </div>
        ))}
        <ScreeningRedFlags />
      </section>

      <section className="mt-8 border-t border-hairline pt-6">
        <h2 className="font-display text-xl font-bold text-ink">4. Determination</h2>
        <p className="mt-1 text-sm text-ink-muted">{cf.determination.reasoning?.summary}</p>
        <div className="mt-4">
          {cf.determination.direction === 'import' && cf.determination.duty_stack ? (
            <DutyStackTable
              lines={cf.determination.duty_stack}
              totalPct={cf.determination.landed_cost_estimate_pct}
              htsCode={cf.classification.selected_code}
              declaredValueUsd={cf.determination.declared_value_usd}
              landedCostUsd={cf.determination.landed_cost_usd}
              deMinimisNote={cf.determination.de_minimis_note}
            />
          ) : (
            <LicensePath determination={cf.determination} />
          )}
        </div>
        {cf.determination.reasoning && <ReasoningPanel reasoning={cf.determination.reasoning} />}
      </section>

      {cf.open_issues.length > 0 && (
        <section id="open-issues" className="mt-8 scroll-mt-20 border-t border-hairline pt-6">
          <h2 className="font-display text-xl font-bold text-ink">Open issues for a human analyst</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
            {cf.open_issues.map((issue, i) => (
              <li key={i}>{issue}</li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-12 border-t border-hairline pt-4 text-xs text-ink-faint">
        Trade compliance determinations depend on facts not captured here. Consult a licensed customs broker or trade attorney before relying on this for an
        actual transaction.
      </p>
    </div>
  );
}
