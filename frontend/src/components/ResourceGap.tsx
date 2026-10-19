import { useMemo, useState } from 'react';
import type { OpinionResponse, PowerIndicator } from '../lib/api';
import { formatShort } from '../lib/powerFormat';
import { nameFor, SERIES_COLORS } from '../lib/powerCountries';
import { spearman } from '../lib/powerStats';
import { surveysFor } from './AttitudesPanel';

type Resource = { id: string; label: string; unit: PowerIndicator['unit']; values: Map<string, number> };

function describe(rho: number): string {
  const a = Math.abs(rho);
  const strength = a < 0.25 ? 'no clear' : a < 0.5 ? 'a weak' : a < 0.75 ? 'a moderate' : 'a strong';
  return a < 0.25 ? 'no clear relationship' : `${strength} ${rho > 0 ? 'positive' : 'negative'} relationship`;
}

// The question practitioners ask of every soft-power index: do the things a country has (wealth, good governance, aid, trade)
// turn into goodwill? Each polled country is one point: what it has on the horizontal axis, how favorably its people view the
// United States or China on the vertical. The rank correlation is reported plainly and described, never turned into a score.
export function ResourceGap({ indicators, opinion, year, codes }: { indicators: PowerIndicator[]; opinion: OpinionResponse; year: number; codes: string[] }) {
  const resources = useMemo<Resource[]>(() => {
    const by = new Map(indicators.map((i) => [i.id, i]));
    const dist = (id: string) => new Map(by.get(id)?.distribution ?? []);
    const gdp = dist('gdp_usd');
    const pop = dist('population');
    const perPerson = new Map<string, number>();
    for (const [cc, g] of gdp) {
      const p = pop.get(cc);
      if (p && p > 0) perPerson.set(cc, g / p);
    }
    const list: Resource[] = [{ id: 'gdp_pc', label: 'Income per person (GDP per person)', unit: 'usd', values: perPerson }];
    for (const id of ['wgi_voice', 'wgi_rule_of_law', 'wgi_effectiveness', 'wgi_corruption', 'military_gdp', 'trade_gdp', 'migrant_share', 'tourist_arrivals', 'science_articles']) {
      const i = by.get(id);
      if (i) list.push({ id, label: i.label, unit: i.unit, values: dist(id) });
    }
    return list;
  }, [indicators]);

  const [resourceId, setResourceId] = useState('gdp_pc');
  const [subject, setSubject] = useState<'US' | 'CN'>('CN');
  const resource = resources.find((r) => r.id === resourceId) ?? resources[0];
  const survey = surveysFor(opinion, year)[subject === 'US' ? 'us' : 'cn'];
  if (!survey) return null;

  const points = Object.entries(survey.favorable)
    .map(([cc, y]) => ({ cc, x: resource.values.get(cc), y }))
    .filter((p): p is { cc: string; x: number; y: number } => p.x !== undefined);
  const rho = spearman(points.map((p) => p.x), points.map((p) => p.y));
  const xs = points.map((p) => p.x);
  const min = Math.min(...xs);
  const max = Math.max(...xs);
  const log = min > 0 && max / min >= 100;
  const t = (v: number) => (log ? (Math.log(v) - Math.log(min)) / (Math.log(max) - Math.log(min)) : (v - min) / (max - min || 1));
  const subjectName = subject === 'US' ? 'the United States' : 'China';

  return (
    <div className="card min-w-0 px-4 pb-4 pt-4">
      <h3 className="text-[15px] font-semibold text-ink">Do resources turn into goodwill?</h3>
      <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
        Each dot is a country Pew polled in {year}. Across, what the country has; up, the share of its people with a favorable view of {subjectName}.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-ink-muted">Views of</span>
          <select value={subject} onChange={(e) => setSubject(e.target.value as 'US' | 'CN')} className="border border-hairline-strong bg-paper-raised px-2 py-1 text-sm">
            <option value="CN">China</option>
            <option value="US">the United States</option>
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <span className="text-ink-muted">against</span>
          <select value={resourceId} onChange={(e) => setResourceId(e.target.value)} className="border border-hairline-strong bg-paper-raised px-2 py-1 text-sm">
            {resources.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {points.length >= 5 ? (
        <>
          <div className="mt-3 flex">
            <span className="w-8 shrink-0 text-right text-[11px] text-ink-faint [writing-mode:vertical-rl] rotate-180">% favorable</span>
            <figure className="min-w-0 flex-1">
              <svg
                role="img"
                width="100%"
                height="300"
                aria-label={`Scatter of ${points.length} countries: ${resource.label} against the share favorable toward ${subjectName}. ${rho === null ? '' : `Rank correlation ${rho.toFixed(2)}, ${describe(rho)}.`}`}
                className="block overflow-visible bg-paper"
              >
                {[0, 25, 50, 75, 100].map((g) => (
                  <g key={g}>
                    <line x1="0" x2="100%" y1={`${100 - g}%`} y2={`${100 - g}%`} stroke="var(--color-hairline)" strokeWidth="1" />
                    <text x="4" y={`${100 - g}%`} dy={g === 0 ? -4 : 12} fontSize="10" fill="var(--color-ink-faint)">
                      {g}%
                    </text>
                  </g>
                ))}
                {points.map((p) => {
                  const idx = codes.indexOf(p.cc);
                  const cx = `${(3 + t(p.x) * 94).toFixed(2)}%`;
                  const cy = `${(97 - p.y * 0.94).toFixed(2)}%`;
                  return (
                    <g key={p.cc}>
                      <circle cx={cx} cy={cy} r={idx >= 0 ? 7 : 4.5} fill={idx >= 0 ? SERIES_COLORS[idx] : 'var(--color-hue-gray)'} opacity={idx >= 0 ? 1 : 0.7} stroke="var(--color-paper-raised)" strokeWidth="1.5">
                        <title>{`${nameFor(p.cc)}: ${formatShort(resource.unit, p.x)}, ${p.y}% favorable`}</title>
                      </circle>
                      <text x={cx} y={cy} dx="8" dy="-6" fontSize="10" fill="var(--color-ink-muted)" fontWeight={idx >= 0 ? 700 : 400}>
                        {p.cc}
                      </text>
                    </g>
                  );
                })}
              </svg>
              <figcaption className="mt-1 flex justify-between text-[11px] text-ink-faint">
                <span>{formatShort(resource.unit, min)}</span>
                <span>
                  {resource.label}
                  {log ? ' (log scale)' : ''}
                </span>
                <span>{formatShort(resource.unit, max)}</span>
              </figcaption>
            </figure>
          </div>
          <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
            {rho === null ? (
              'Not enough variation to compare.'
            ) : (
              <>
                Across these {points.length} countries the rank correlation (Spearman) is <span className="font-semibold text-ink tabular-nums">{rho.toFixed(2)}</span>:{' '}
                {describe(rho)}. It describes the countries Pew polled, mostly large or well-known ones, and does not show that one thing causes the other.
              </>
            )}
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-ink-faint">Too few polled countries have this measure to compare.</p>
      )}
    </div>
  );
}
