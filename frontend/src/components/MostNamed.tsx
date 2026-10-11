import { Link } from 'react-router-dom';
import { COUNTRY_LABELS } from '../lib/pulseCountries';
import { RailModule } from './RailModule';

// The countries named most often in new U.S. notices over the last 30 days: the same counts that colour
// the globe, as a ranked list. Each row opens that country's page.
export function MostNamed({ breakdown }: { breakdown: { country: string; count: number }[] }) {
  const top = breakdown.filter((b) => b.country !== 'US').slice(0, 6);
  const max = Math.max(...top.map((b) => b.count), 1);
  if (top.length === 0) return null;
  return (
    <RailModule title="Most named, last 30 days">
      <ul className="flex flex-col gap-2">
        {top.map((b) => (
          <li key={b.country}>
            <Link to={`/country/${b.country.toLowerCase()}`} className="grid grid-cols-[7rem_minmax(0,1fr)_2rem] items-center gap-3 text-[13px] text-ink no-underline hover:text-accent">
              <span className="truncate">{COUNTRY_LABELS[b.country] ?? b.country}</span>
              <span className="h-1.5 bg-paper" aria-hidden="true">
                <span className="block h-full bg-hue-cyan" style={{ width: `${(b.count / max) * 100}%` }} />
              </span>
              <span className="text-right tabular-nums">{b.count}</span>
            </Link>
          </li>
        ))}
      </ul>
    </RailModule>
  );
}
