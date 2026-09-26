import type { ActiveMeasure } from '../types/pulse';

const PROGRAM_LABEL: Record<string, string> = {
  sec232_steel: 'Section 232: Steel',
  sec232_aluminum: 'Section 232: Aluminum',
  sec232_copper: 'Section 232: Copper',
  sec232_autos: 'Section 232: Autos',
  sec232_metals_country_cap: 'Section 232: Metals (country cap)',
  sec301_china: 'Section 301: China',
  sec301_forced_labor: 'Section 301: Forced labor',
  sec338_canada: 'Section 338: Canada',
};

// One-line plain-language gloss on the legal authority behind a measure,
// for anyone who doesn't already know what "Section 232" means -- keyed by
// program-name prefix since the authority, not the specific commodity, is
// what needs explaining.
const SECTION_HINT: [prefix: string, hint: string][] = [
  ['sec232_', 'Section 232: tariffs the President can impose when an import is deemed a national-security risk.'],
  ['sec301_', "Section 301: tariffs the U.S. Trade Representative can impose in response to another country's unfair trade practices."],
  ['sec338_', 'Section 338: tariffs authorized in response to another country discriminating against U.S. commerce.'],
];

function sectionHint(program: string): string | undefined {
  return SECTION_HINT.find(([prefix]) => program.startsWith(prefix))?.[1];
}

function rateLabel(m: ActiveMeasure): string {
  if (m.min_rate_pct === null) return '—';
  const suffix = m.rate_type === 'ad_valorem' ? '%' : '';
  return m.min_rate_pct === m.max_rate_pct ? `${m.min_rate_pct}${suffix}` : `${m.min_rate_pct}-${m.max_rate_pct}${suffix}`;
}

function htsLabel(m: ActiveMeasure): string {
  return m.line_count === 1 ? `HTS ${m.sample_hts}` : `${m.line_count} HTS lines`;
}

function scopeLabel(m: ActiveMeasure): string {
  if (m.country_count === 0) return 'All countries';
  if (m.country_count === 1) return m.sample_scope ?? '1 country';
  return `${m.country_count} countries`;
}

// Same 90-day window as the summary stat strip's newMeasures90d count --
// plain date math, kept in sync by using the identical threshold.
function isRecent(effectiveDate: string): boolean {
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  return effectiveDate >= ninetyDaysAgo.toISOString().slice(0, 10);
}

export function ActiveMeasuresTable({ overlays }: { overlays: ActiveMeasure[] }) {
  if (overlays.length === 0) {
    return <p className="text-sm text-ink-faint">No measures currently in force.</p>;
  }
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-[26rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-hairline-strong text-left text-ink-muted">
            <th className="py-1.5 pr-3 font-normal">Measure</th>
            <th className="py-1.5 pr-3 font-normal">Scope</th>
            <th className="py-1.5 pr-3 font-normal">Rate</th>
            <th className="py-1.5 font-normal">Effective</th>
          </tr>
        </thead>
        <tbody>
          {overlays.map((m) => (
            <tr key={`${m.program}-${m.legal_basis}`} className="border-b border-hairline">
              <td className="py-2 pr-3 align-top">
                <a href={m.source_url} target="_blank" rel="noreferrer" className="text-ink no-underline hover:text-accent" title={sectionHint(m.program)}>
                  {PROGRAM_LABEL[m.program] ?? m.program}
                </a>
                {isRecent(m.effective_date) && (
                  <span className="ml-2 border border-accent/40 bg-accent-soft px-1 py-0.5 align-middle text-[10px] font-medium text-accent">New</span>
                )}
                <div className="mt-0.5 tabular-nums text-xs text-ink-faint">{htsLabel(m)}</div>
              </td>
              <td className="py-2 pr-3 align-top tabular-nums whitespace-nowrap">{scopeLabel(m)}</td>
              <td className="py-2 pr-3 align-top tabular-nums whitespace-nowrap">{rateLabel(m)}</td>
              <td className="py-2 align-top tabular-nums whitespace-nowrap">{m.effective_date}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
