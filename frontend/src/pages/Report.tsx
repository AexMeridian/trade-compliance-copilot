import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { CaseFile, PartyMatch, Verdict } from '../types/case';
import { getReport, submitScreening } from '../lib/api';
import { VerdictBanner } from '../components/VerdictBanner';
import { DutyStackTable } from '../components/DutyStackTable';
import { LicensePath } from '../components/LicensePath';
import { ReasoningPanel } from '../components/ReasoningPanel';
import { ScreeningRedFlags } from '../components/ScreeningRedFlags';
import { SummaryList } from '../components/SummaryList';
import { IssueList, type ParsedIssue } from '../components/IssueList';
import { Facts, ReportSection, StatusChip, type Tone } from '../components/ReportBits';
import { agoText } from '../lib/pulsePlain';
import { SITE } from '../lib/site';

const SCREENING_PLAIN = { none: 'No matches', caution: 'Needs a closer look', hard_stop: 'Blocked party found' } as const;
const SCREENING_TONE: Record<keyof typeof SCREENING_PLAIN, Tone> = { none: 'clear', caution: 'review', hard_stop: 'stop' };
const LICENSE_TONE: Record<string, Tone> = { NLR: 'clear', 'License Required': 'stop', 'License Exception May Apply': 'review', 'Insufficient Data': 'review' };
const VERDICT_WORD: Record<string, string> = { true_match: 'True match', false_positive: 'Cleared (false positive)', inconclusive: 'Inconclusive' };

function MatchRow({ m }: { m: PartyMatch }) {
  const tone = m.verdict === 'true_match' ? 'text-stop' : m.verdict === 'inconclusive' ? 'text-review' : 'text-ink-faint';
  return (
    <div className="py-2.5">
      <p className="text-sm">
        <span className="font-medium text-ink">{m.matched_name}</span> <span className={`font-semibold ${tone}`}>{VERDICT_WORD[m.verdict] ?? m.verdict}</span>
      </p>
      <p className="text-xs tabular-nums text-ink-faint">
        {m.matched_list} · match score {m.match_score.toFixed(2)}
        {m.token_sort_score !== undefined && m.jaro_winkler_score !== undefined &&
          ` · via ${m.matched_via === 'alias' ? 'an alias' : 'the primary name'} (token-sort ${m.token_sort_score.toFixed(2)}, Jaro-Winkler ${m.jaro_winkler_score.toFixed(2)})`}
      </p>
      <SummaryList text={m.risk_memo} className="mt-1.5" />
    </div>
  );
}

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
  const det = cf.determination;
  const isImport = cf.direction === 'import';
  const sev = cf.screening.highest_severity;

  // One line per module, in plain words, so the answer is visible without
  // reading the reasoning below it.
  const dutyValue = isImport
    ? det.landed_cost_estimate_pct !== null
      ? `${det.landed_cost_estimate_pct}% duty`
      : 'Needs manual calculation'
    : (det.license_requirement ?? 'Not determined');
  const originWord = cf.origin.qualifies === null ? 'Undetermined' : cf.origin.qualifies ? 'Qualifies' : 'Does not qualify';
  const glance = [
    { label: 'Product code', value: cf.classification.selected_code ?? 'Not resolved' },
    { label: 'USMCA origin', value: isImport ? originWord : 'Not applicable' },
    { label: 'Party screening', value: SCREENING_PLAIN[sev] },
    { label: isImport ? 'Estimated duty' : 'Export license', value: dutyValue },
  ];

  const cls = cf.classification;
  const org = cf.origin;
  // USMCA origin isn't part of an export case; drop any leftover origin notes.
  const issues = isImport ? cf.open_issues : cf.open_issues.filter((s) => !/^Origin\b/.test(s));
  const lead: ParsedIssue[] = [];
  if (sev === 'hard_stop') lead.push({ group: 'Screening', title: 'Blocked party found', body: '' });
  if (!isImport && det.license_requirement === 'License Required') lead.push({ group: 'Determination', title: 'Export license required for this destination', body: '' });
  const originTone: Tone = org.qualifies === null ? 'review' : org.qualifies ? 'clear' : 'stop';
  const dutyTone: Tone = isImport ? (det.landed_cost_estimate_pct !== null ? 'neutral' : 'review') : (LICENSE_TONE[det.license_requirement ?? ''] ?? 'neutral');

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
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
      <VerdictBanner verdict={verdict} caseId={cf.id} generatedAt={generated_at} issues={issues} lead={lead} />

      <dl className="mt-4 grid grid-cols-2 gap-px border border-hairline bg-hairline text-sm sm:grid-cols-4">
        {glance.map((g) => (
          <div key={g.label} className="bg-paper px-3 py-2">
            <dt className="text-xs text-ink-faint">{g.label}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums text-ink">{g.value}</dd>
          </div>
        ))}
      </dl>

      <ReportSection
        n={1}
        title="Classification"
        chip={cls.ambiguous ? <StatusChip tone="review">Ambiguous: confirm</StatusChip> : cls.reasoning ? <StatusChip tone={cls.reasoning.confidence === 'high' ? 'clear' : cls.reasoning.confidence === 'low' ? 'stop' : 'review'}>{cls.reasoning.confidence} confidence</StatusChip> : undefined}
      >
        <p className="font-display text-2xl font-bold tabular-nums text-ink">{cls.selected_code ?? 'Not resolved'}</p>
        <div className="mt-3">
          <Facts
            items={[
              { label: 'Product as described', value: cls.product_description },
              { label: 'HS-6 heading', value: cls.hs6 },
              { label: 'Also plausible', value: cls.ambiguous_alternatives.length ? <span className="tabular-nums">{cls.ambiguous_alternatives.join(', ')}</span> : null },
              { label: 'Schedule B (export) code', value: cls.cross_reference_code },
            ]}
          />
        </div>
        <SummaryList text={cls.reasoning?.summary} className="mt-4" />
        {cls.reasoning && <ReasoningPanel reasoning={cls.reasoning} />}
      </ReportSection>

      {isImport && (
        <ReportSection n={2} title="Origin" chip={<StatusChip tone={originTone}>{originWord}</StatusChip>}>
          <Facts
            items={[
              { label: 'Rule applied', value: org.applicable_rule ? `${org.applicable_rule.rule_type.replace(/_/g, ' ')}: ${org.applicable_rule.citation}` : 'No curated rule for this heading' },
              { label: 'Final assembly', value: org.final_assembly_country },
              { label: 'Tariff shift met', value: org.tariff_shift_met === null ? null : org.tariff_shift_met ? 'Yes' : 'No' },
              {
                label: 'Regional value content',
                value: org.rvc_calculated_pct !== null ? `${org.rvc_calculated_pct}%${org.rvc_threshold_pct !== null ? ` (threshold ${org.rvc_threshold_pct}%)` : ''}` : null,
              },
            ]}
          />
          <SummaryList text={org.reasoning?.summary} className="mt-4" />
          {org.reasoning && <ReasoningPanel reasoning={org.reasoning} />}
        </ReportSection>
      )}

      <ReportSection
        n={isImport ? 3 : 2}
        title="Screening"
        chip={<StatusChip tone={SCREENING_TONE[sev]}>{SCREENING_PLAIN[sev]}</StatusChip>}
        action={
          <button type="button" onClick={handleRescreen} disabled={rescreening} className="no-print btn text-xs">
            {rescreening ? 'Re-screening…' : 'Re-screen parties'}
          </button>
        }
      >
        {cf.screening.screened_at && (
          <p className="text-xs text-ink-faint">Screened {agoText(cf.screening.screened_at)}. Watchlists change; re-screen before acting on an older result.</p>
        )}
        <div className="mt-3 space-y-4">
          {cf.screening.parties.map((p, i) => {
            const act = p.matches.filter((m) => m.verdict !== 'false_positive');
            const cleared = p.matches.filter((m) => m.verdict === 'false_positive');
            return (
              <div key={i} className="border border-hairline px-3 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-semibold text-ink">
                    <span className="mr-2 font-normal capitalize text-ink-faint">{p.role}</span>
                    {p.input_name}
                  </p>
                  <span className="text-xs text-ink-faint">
                    {p.matches.length === 0 ? 'No candidate matches' : act.length === 0 ? `${cleared.length} possible match${cleared.length === 1 ? '' : 'es'}, all cleared` : `${act.length} need${act.length === 1 ? 's' : ''} attention`}
                  </span>
                </div>
                {act.length > 0 && <div className="mt-1 divide-y divide-hairline">{act.map((m, j) => <MatchRow key={j} m={m} />)}</div>}
                {cleared.length > 0 && (
                  <details className="mt-1.5">
                    <summary className="cursor-pointer text-xs font-medium text-ink-muted hover:text-ink">
                      Show {cleared.length} cleared match{cleared.length === 1 ? '' : 'es'} and why
                    </summary>
                    <div className="mt-1 divide-y divide-hairline">{cleared.map((m, j) => <MatchRow key={j} m={m} />)}</div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
        <ScreeningRedFlags />
      </ReportSection>

      <ReportSection
        n={isImport ? 4 : 3}
        title="Determination"
        chip={<StatusChip tone={dutyTone}>{isImport ? (det.landed_cost_estimate_pct !== null ? `${det.landed_cost_estimate_pct}% estimated duty` : 'Duty needs manual calculation') : (det.license_requirement ?? 'Unresolved')}</StatusChip>}
      >
        <SummaryList text={det.reasoning?.summary} />
        <div className="mt-4">
          {isImport && det.duty_stack ? (
            <DutyStackTable
              lines={det.duty_stack}
              totalPct={det.landed_cost_estimate_pct}
              htsCode={cls.selected_code}
              declaredValueUsd={det.declared_value_usd}
              landedCostUsd={det.landed_cost_usd}
              deMinimisNote={det.de_minimis_note}
            />
          ) : (
            <LicensePath determination={det} />
          )}
        </div>
        {det.reasoning && <ReasoningPanel reasoning={det.reasoning} />}
      </ReportSection>

      {issues.length > 0 && (
        <section id="open-issues" className="mt-8 scroll-mt-20">
          <h2 className="flex items-baseline gap-2 font-display text-lg font-bold text-ink">
            Open issues for a human analyst
            <span className="text-sm font-normal tabular-nums text-ink-faint">{issues.length}</span>
          </h2>
          <IssueList issues={issues} />
        </section>
      )}

      <p className="mt-12 max-w-prose border-t border-hairline pt-4 text-xs text-ink-faint">
        Trade compliance determinations depend on facts not captured here. Consult a licensed customs broker or trade attorney before relying on this for an
        actual transaction.
      </p>
    </div>
  );
}
