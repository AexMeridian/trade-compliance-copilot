import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { CaseFile, Verdict } from '../types/case';
import { getReport } from '../lib/api';
import { VerdictBanner } from '../components/VerdictBanner';
import { DutyStackTable } from '../components/DutyStackTable';
import { LicensePath } from '../components/LicensePath';
import { ReasoningPanel } from '../components/ReasoningPanel';

export function Report() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<{ case_file: CaseFile; verdict: Verdict; generated_at: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getReport(id)
      .then(setData)
      .catch((e) => setLoadError((e as Error).message));
  }, [id]);

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

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <VerdictBanner verdict={verdict} caseId={cf.id} generatedAt={generated_at} />

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
        <h2 className="font-display text-xl font-bold text-ink">3. Screening</h2>
        <p className="mt-1 text-sm capitalize">{cf.screening.highest_severity.replace('_', ' ')}</p>
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
                <div className="text-sm text-ink-muted">{m.risk_memo}</div>
              </div>
            ))}
          </div>
        ))}
      </section>

      <section className="mt-8 border-t border-hairline pt-6">
        <h2 className="font-display text-xl font-bold text-ink">4. Determination</h2>
        <p className="mt-1 text-sm text-ink-muted">{cf.determination.reasoning?.summary}</p>
        <div className="mt-4">
          {cf.determination.direction === 'import' && cf.determination.duty_stack ? (
            <DutyStackTable lines={cf.determination.duty_stack} totalPct={cf.determination.landed_cost_estimate_pct} />
          ) : (
            <LicensePath determination={cf.determination} />
          )}
        </div>
        {cf.determination.reasoning && <ReasoningPanel reasoning={cf.determination.reasoning} />}
      </section>

      {cf.open_issues.length > 0 && (
        <section className="mt-8 border-t border-hairline pt-6">
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
