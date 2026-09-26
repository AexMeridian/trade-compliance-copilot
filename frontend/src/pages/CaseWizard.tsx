import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { CaseFile, OriginComponent, PartyRole } from '../types/case';
import { getCase, submitClassification, submitOrigin, submitScreening, submitDetermination } from '../lib/api';
import { ReasoningPanel } from '../components/ReasoningPanel';

const STEPS = ['Classification', 'Origin', 'Screening', 'Determination'] as const;

export function CaseWizard() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [caseFile, setCaseFile] = useState<CaseFile | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getCase(id)
      .then((r) => {
        setCaseFile(r.case_file);
        const step =
          r.case_file.classification.status !== 'complete'
            ? 0
            : r.case_file.origin.status !== 'complete'
              ? 1
              : r.case_file.screening.status !== 'complete'
                ? 2
                : 3;
        setActiveStep(step);
      })
      .catch((e) => setLoadError((e as Error).message));
  }, [id]);

  if (!id || loadError) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <p className="border border-stop/30 bg-stop-soft px-3 py-2 text-sm text-stop">
          {loadError ? `Couldn't load this case. (${loadError})` : 'No case selected.'}
        </p>
      </div>
    );
  }
  if (!caseFile) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16">
        <p className="card py-6 text-center text-sm text-ink-faint">Loading case…</p>
      </div>
    );
  }

  const stepDone = [
    caseFile.classification.status === 'complete',
    caseFile.origin.status === 'complete',
    caseFile.screening.status === 'complete',
    caseFile.determination.status === 'complete',
  ];

  return (
    <div className="mx-auto grid max-w-4xl grid-cols-1 gap-6 px-4 py-12 sm:grid-cols-[11rem_1fr] sm:gap-10">
      <nav className="pt-1">
        <ol>
          {STEPS.map((label, i) => {
            const state = activeStep === i ? 'active' : stepDone[i] ? 'done' : 'pending';
            return (
              <li key={label}>
                <button
                  type="button"
                  disabled={i > 0 && !stepDone[i - 1]}
                  onClick={() => setActiveStep(i)}
                  className="flex w-full items-start gap-3 py-1.5 text-left disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="flex flex-col items-center">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center border tabular-nums text-xs ${
                        state === 'active'
                          ? 'border-accent text-accent'
                          : state === 'done'
                            ? 'border-clear bg-clear-soft text-clear'
                            : 'border-hairline-strong text-ink-muted'
                      }`}
                    >
                      {state === 'done' ? '✓' : i + 1}
                    </span>
                    {i < STEPS.length - 1 && <span className="my-0.5 h-7 w-px bg-hairline-strong" />}
                  </span>
                  <span className={`pt-0.5 text-sm ${state === 'active' ? 'font-medium text-accent' : state === 'done' ? 'text-ink' : 'text-ink-muted'}`}>
                    {label}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div>
        {error && <p className="mb-4 border border-stop/30 bg-stop-soft px-3 py-2 text-sm text-stop">{error}</p>}
        {activeStep === 0 && (
          <ClassificationStep
            caseFile={caseFile}
            onDone={(cf) => {
              setCaseFile(cf);
              setActiveStep(1);
            }}
            onError={setError}
          />
        )}
        {activeStep === 1 && (
          <OriginStep
            caseFile={caseFile}
            onDone={(cf) => {
              setCaseFile(cf);
              setActiveStep(2);
            }}
            onError={setError}
          />
        )}
        {activeStep === 2 && (
          <ScreeningStep
            caseFile={caseFile}
            onDone={(cf) => {
              setCaseFile(cf);
              setActiveStep(3);
            }}
            onError={setError}
          />
        )}
        {activeStep === 3 && (
          <DeterminationStep
            caseFile={caseFile}
            onDone={(cf) => {
              setCaseFile(cf);
              navigate(`/case/${id}/report`);
            }}
            onError={setError}
          />
        )}
      </div>
    </div>
  );
}

function StepShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="display text-2xl text-ink">{title}</h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function ClassificationStep({ caseFile, onDone, onError }: { caseFile: CaseFile; onDone: (c: CaseFile) => void; onError: (e: string | null) => void }) {
  const [description, setDescription] = useState(caseFile.classification.product_description || '');
  const [loading, setLoading] = useState(false);
  const c = caseFile.classification;

  async function submit() {
    if (!description.trim()) return;
    setLoading(true);
    onError(null);
    try {
      const { classification } = await submitClassification(caseFile.id, description);
      onDone({ ...caseFile, classification });
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <StepShell title="Classification">
      <label className="block text-sm text-ink-muted">
        Describe the product in plain English
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          className="mt-1.5 w-full border border-hairline-strong bg-paper-raised px-3 py-2 text-sm text-ink outline-none focus:border-accent"
          placeholder="e.g. A rechargeable handheld cordless vacuum cleaner with a HEPA filter"
        />
      </label>
      <button type="button" onClick={submit} disabled={loading} className="btn-primary mt-3">
        {loading ? 'Classifying…' : 'Classify product'}
      </button>

      {c.status === 'complete' && c.selected_code && (
        <div className="mt-6 border-t border-hairline pt-4">
          <div className="tabular-nums text-lg text-ink">{c.selected_code}</div>
          <div className="text-sm text-ink-muted">{c.reasoning?.summary}</div>
          {c.ambiguous && (
            <p className="mt-2 border border-review/30 bg-review-soft px-3 py-2 text-sm text-review">Ambiguous with: {c.ambiguous_alternatives.join(', ')}</p>
          )}
          {c.cross_reference_code && (
            <p className="mt-2 text-sm text-ink-muted">
              Cross-reference ({c.direction === 'import' ? 'Schedule B' : 'HTS'}): <span className="tabular-nums">{c.cross_reference_code}</span>
            </p>
          )}
          {c.reasoning && <ReasoningPanel reasoning={c.reasoning} />}
        </div>
      )}
    </StepShell>
  );
}

function OriginStep({ caseFile, onDone, onError }: { caseFile: CaseFile; onDone: (c: CaseFile) => void; onError: (e: string | null) => void }) {
  const [components, setComponents] = useState<OriginComponent[]>(
    caseFile.origin.components.length ? caseFile.origin.components : [{ description: '', origin_country: '', value_pct: null }],
  );
  const [assembly, setAssembly] = useState(caseFile.origin.final_assembly_country ?? '');
  const [loading, setLoading] = useState(false);
  const o = caseFile.origin;

  function updateComponent(i: number, patch: Partial<OriginComponent>) {
    setComponents((prev) => prev.map((comp, idx) => (idx === i ? { ...comp, ...patch } : comp)));
  }

  async function submit() {
    setLoading(true);
    onError(null);
    try {
      const { origin } = await submitOrigin(caseFile.id, components, assembly);
      onDone({ ...caseFile, origin });
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <StepShell title="Origin / USMCA eligibility">
      <div className="space-y-3">
        {components.map((comp, i) => (
          <div key={i} className="grid grid-cols-[1fr_6rem_5rem] gap-2">
            <input
              value={comp.description}
              onChange={(e) => updateComponent(i, { description: e.target.value })}
              placeholder="Component description"
              className="border border-hairline-strong bg-paper-raised px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
            <input
              value={comp.origin_country}
              onChange={(e) => updateComponent(i, { origin_country: e.target.value.toUpperCase() })}
              placeholder="ISO country"
              maxLength={2}
              className="border border-hairline-strong bg-paper-raised px-2 py-1.5 text-sm tabular-nums outline-none focus:border-accent"
            />
            <input
              type="number"
              value={comp.value_pct ?? ''}
              onChange={(e) => updateComponent(i, { value_pct: e.target.value === '' ? null : Number(e.target.value) })}
              placeholder="% value"
              className="border border-hairline-strong bg-paper-raised px-2 py-1.5 text-sm tabular-nums outline-none focus:border-accent"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setComponents((prev) => [...prev, { description: '', origin_country: '', value_pct: null }])}
          className="text-sm text-accent hover:underline"
        >
          Add component
        </button>
      </div>

      <label className="mt-4 block text-sm text-ink-muted">
        Final assembly country (ISO code)
        <input
          value={assembly}
          onChange={(e) => setAssembly(e.target.value.toUpperCase())}
          maxLength={2}
          className="mt-1.5 block w-24 border border-hairline-strong bg-paper-raised px-2 py-1.5 tabular-nums text-sm outline-none focus:border-accent"
        />
      </label>

      <button type="button" onClick={submit} disabled={loading} className="btn-primary mt-4">
        {loading ? 'Assessing…' : 'Assess origin'}
      </button>

      {o.status === 'complete' && (
        <div className="mt-6 border-t border-hairline pt-4">
          <div className="text-lg text-ink">{o.qualifies === null ? 'Indeterminate' : o.qualifies ? 'Qualifies for USMCA' : 'Does not qualify for USMCA'}</div>
          <div className="text-sm text-ink-muted">{o.reasoning?.summary}</div>
          {o.rvc_calculated_pct !== null && o.rvc_threshold_pct !== null && (
            <p className="mt-1 tabular-nums text-sm">
              RVC {o.rvc_calculated_pct}% against a {o.rvc_threshold_pct}% threshold
            </p>
          )}
          {o.reasoning && <ReasoningPanel reasoning={o.reasoning} />}
        </div>
      )}
    </StepShell>
  );
}

function ScreeningStep({ caseFile, onDone, onError }: { caseFile: CaseFile; onDone: (c: CaseFile) => void; onError: (e: string | null) => void }) {
  const [parties, setParties] = useState<{ role: PartyRole; name: string }[]>(
    caseFile.screening.parties.length
      ? caseFile.screening.parties.map((p) => ({ role: p.role, name: p.input_name }))
      : [
          { role: 'seller', name: '' },
          { role: 'buyer', name: '' },
        ],
  );
  const [loading, setLoading] = useState(false);
  const s = caseFile.screening;

  function updateParty(i: number, patch: Partial<{ role: PartyRole; name: string }>) {
    setParties((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  async function submit() {
    const filled = parties.filter((p) => p.name.trim());
    if (filled.length === 0) return;
    setLoading(true);
    onError(null);
    try {
      const { screening } = await submitScreening(caseFile.id, filled);
      onDone({ ...caseFile, screening });
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <StepShell title="Party screening">
      <div className="space-y-2">
        {parties.map((p, i) => (
          <div key={i} className="grid grid-cols-[7rem_1fr] gap-2">
            <select
              value={p.role}
              onChange={(e) => updateParty(i, { role: e.target.value as PartyRole })}
              className="border border-hairline-strong bg-paper-raised px-2 py-1.5 text-sm outline-none focus:border-accent"
            >
              <option value="buyer">Buyer</option>
              <option value="seller">Seller</option>
              <option value="intermediary">Intermediary</option>
            </select>
            <input
              value={p.name}
              onChange={(e) => updateParty(i, { name: e.target.value })}
              placeholder="Party name"
              className="border border-hairline-strong bg-paper-raised px-2 py-1.5 text-sm outline-none focus:border-accent"
            />
          </div>
        ))}
        <button
          type="button"
          onClick={() => setParties((prev) => [...prev, { role: 'intermediary', name: '' }])}
          className="text-sm text-accent hover:underline"
        >
          Add party
        </button>
      </div>

      <button type="button" onClick={submit} disabled={loading} className="btn-primary mt-4">
        {loading ? 'Screening…' : 'Screen parties'}
      </button>

      {s.status === 'complete' && (
        <div className="mt-6 space-y-4 border-t border-hairline pt-4">
          {s.parties.map((p, i) => (
            <div key={i}>
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
        </div>
      )}
    </StepShell>
  );
}

function DeterminationStep({ caseFile, onDone, onError }: { caseFile: CaseFile; onDone: (c: CaseFile) => void; onError: (e: string | null) => void }) {
  const [loading, setLoading] = useState(false);
  const [destination, setDestination] = useState(caseFile.determination.destination_country ?? '');
  const isExport = caseFile.direction === 'export';

  async function submit() {
    if (isExport && !destination.trim()) return;
    setLoading(true);
    onError(null);
    try {
      const { determination } = await submitDetermination(caseFile.id, isExport ? destination : undefined);
      onDone({ ...caseFile, determination });
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <StepShell title="Final determination">
      <p className="text-sm text-ink-muted">
        Combines classification, origin, and screening results into a {caseFile.direction === 'import' ? 'landed-cost estimate' : 'license determination'}.
      </p>
      {isExport && (
        <label className="mt-3 block text-sm text-ink-muted">
          Destination country (ISO code)
          <input
            value={destination}
            onChange={(e) => setDestination(e.target.value.toUpperCase())}
            maxLength={2}
            placeholder="e.g. DE"
            className="mt-1.5 block w-24 border border-hairline-strong bg-paper-raised px-2 py-1.5 tabular-nums text-sm outline-none focus:border-accent"
          />
        </label>
      )}
      <button type="button" onClick={submit} disabled={loading || (isExport && !destination.trim())} className="btn-primary mt-3">
        {loading ? 'Computing…' : 'Run determination and view report'}
      </button>
    </StepShell>
  );
}
