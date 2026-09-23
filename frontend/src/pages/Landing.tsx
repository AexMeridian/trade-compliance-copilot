import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Direction } from '../types/case';
import { createCase, listSamples } from '../lib/api';

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

export function Landing() {
  const [direction, setDirection] = useState<Direction>('import');
  const [samples, setSamples] = useState<{ id: string; direction: Direction; sample_key: string; product_description: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    listSamples()
      .then((r) => setSamples(r.samples))
      .catch(() => setSamples([]));
  }, []);

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
    <div className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="font-serif text-3xl font-semibold leading-tight text-ink sm:text-4xl">
        Walk a shipment through classification, origin, screening, and
        determination, the way an analyst would.
      </h1>
      <p className="mt-4 max-w-xl text-ink-muted leading-relaxed">
        Every answer here is grounded in a loaded HTS/Schedule B schedule, the
        OFAC SDN list, the BIS Consolidated Screening List, curated USMCA rules,
        and curated ECCN data -- not invented by the model. Pick a direction to
        start a new case, or open one of the sample cases below.
      </p>

      <div className="mt-8 flex gap-2">
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
          className="ml-2 border border-ink bg-ink px-4 py-2 text-sm text-paper hover:bg-ink/90 disabled:opacity-50"
        >
          {creating ? 'Starting…' : `Start new ${direction} case`}
        </button>
      </div>

      <div className="mt-14 border-t border-hairline pt-6">
        <h2 className="font-serif text-lg font-semibold text-ink">Run a sample case</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {samples.map((s) => {
            const label = SAMPLE_LABELS[s.sample_key];
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => navigate(`/case/${s.id}/report`)}
                className="border border-hairline p-3 text-left hover:border-accent"
              >
                <div className="font-mono text-xs text-ink-faint">{s.direction}</div>
                <div className="mt-1 font-serif text-base font-semibold text-ink">{label?.title ?? s.sample_key}</div>
                <div className="mt-1 text-sm text-ink-muted">{label?.note ?? s.product_description}</div>
              </button>
            );
          })}
          {samples.length === 0 && (
            <p className="text-sm text-ink-faint">
              No sample cases are seeded yet -- run <code className="font-mono">npm run seed:samples</code>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
