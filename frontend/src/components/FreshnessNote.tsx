import type { SourceFreshness } from '../types/pulse';

// The as-of line that sits directly under a number built from a refreshed source, so a reader never has to open
// Methodology to learn that a count is weeks old or that a source never loaded.

const SHORT: Record<string, string> = {
  sdn: 'OFAC SDN',
  csl: 'Consolidated Screening List',
  un_sanctions: 'UN list',
  uk_sanctions: 'UK list',
  wro_findings: 'CBP forced-labor orders',
  gta: 'Global Trade Alert',
};

export function describeFreshness(f: SourceFreshness): string {
  const name = SHORT[f.source] ?? f.label;
  if (f.state === 'not_loaded') return `${name}: not loaded`;
  if (f.state === 'stale') return `${name}: as of ${f.as_of ?? 'unknown date'} (out of date${f.last_error ? ', refresh failing' : ''})`;
  return `${name}: as of ${f.as_of}`;
}

export function FreshnessNote({ sources, className = '' }: { sources: (SourceFreshness | null | undefined)[] | undefined; className?: string }) {
  const list = (sources ?? []).filter((s): s is SourceFreshness => !!s);
  if (list.length === 0) return null;
  const bad = list.some((s) => s.state !== 'ok');
  return (
    <p className={`text-xs ${bad ? 'font-semibold text-stop' : 'text-ink-faint'} ${className}`}>
      {bad ? 'Data not current. ' : 'Data '}
      {list.map(describeFreshness).join(' · ')}
    </p>
  );
}

/** True when an empty result can't be trusted as "none": the source never loaded, or is out of date. */
export function emptyIsUnknown(s: SourceFreshness | null | undefined): boolean {
  return !s || s.state === 'not_loaded';
}
