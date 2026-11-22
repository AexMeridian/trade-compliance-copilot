import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Breadcrumb } from '../components/Breadcrumb';
import { PulsePanel } from '../components/PulsePanel';
import { DutyStackTable } from '../components/DutyStackTable';
import { lookupDuty, searchHtsCodes, type DutyLookup } from '../lib/api';
import { TARIFF_COUNTRY_LABELS } from '../lib/pulseTariffCountries';

// The free tariff lookup asked for by the small importer, the Etsy seller and the customs broker in user testing: type product words
// or an HTS code, pick the country it comes from, and see every tariff layer this site models. Pure database lookups, no model call,
// so it can be used as often as anyone likes. The calculator remains the place for a full case (origin, screening, export).

const EXAMPLES: { q: string; label: string }[] = [
  { q: '7323.93', label: 'Stainless steel cookware' },
  { q: '7018.10', label: 'Glass beads' },
  { q: '7117.19', label: 'Costume jewelry, base metal' },
  { q: '8516.60', label: 'Ovens and cookers' },
  { q: '9503.00', label: 'Toys' },
  { q: '6109.10', label: 'Cotton T-shirts' },
];
const COUNTRIES = Object.entries(TARIFF_COUNTRY_LABELS).sort((a, b) => a[1].localeCompare(b[1]));
const isCode = (s: string) => /^[0-9.\s]{4,13}$/.test(s.trim());

export function Lookup() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [country, setCountry] = useState((params.get('country') ?? 'CN').toUpperCase());
  const [hts, setHts] = useState(params.get('hts') ?? '');
  const [results, setResults] = useState<{ htsno: string; description: string; general_rate: string | null }[] | null>(null);
  const [duty, setDuty] = useState<DutyLookup | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hts) return;
    let live = true;
    setBusy(true);
    setError(null);
    lookupDuty(hts, country)
      .then((d) => {
        if (!live) return;
        if ('choices' in d) {
          setDuty(null);
          setResults(d.choices);
        } else {
          setDuty(d);
        }
      })
      .catch((e) => {
        if (!live) return;
        setDuty(null);
        setError((e as Error).message);
      })
      .finally(() => live && setBusy(false));
    return () => {
      live = false;
    };
  }, [hts, country]);

  function pick(code: string) {
    setHts(code);
    const next = new URLSearchParams(params);
    next.set('hts', code);
    next.set('country', country);
    setParams(next, { replace: true });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) return;
    if (isCode(q)) {
      pick(q.replace(/\s/g, ''));
      setResults(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await searchHtsCodes(q);
      setResults(r.results);
      if (r.results.length === 0) setError(`No HTS line matched "${q}". Try a simpler word (for example "beads" or "cookware").`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Breadcrumb trail={[{ label: 'Basics', to: '/basics' }, { label: 'Tariff lookup' }]} />
      <h1 className="display mt-3 text-4xl text-ink sm:text-5xl">Tariff lookup</h1>
      <p className="mt-3 max-w-2xl text-base leading-relaxed text-ink-muted">
        Every product has a code in the U.S. tariff schedule (the HTS, or Harmonized Tariff Schedule). Search by words or type the code, choose the country
        the goods come from, and see each tariff that applies, added up. Free, instant, and no account needed.
      </p>

      <form onSubmit={submit} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm text-ink-muted">
          Product words or HTS code
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="for example: stainless cookware, or 7323.93"
            className="mt-1 w-full border border-hairline-strong bg-paper-raised px-3 py-2 text-base text-ink outline-none focus:border-accent"
          />
        </label>
        <label className="text-sm text-ink-muted">
          Made in
          <select
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              if (hts) {
                const next = new URLSearchParams(params);
                next.set('country', e.target.value);
                setParams(next, { replace: true });
              }
            }}
            className="mt-1 block w-full border border-hairline-strong bg-paper-raised px-3 py-2 text-base text-ink outline-none focus:border-accent sm:w-56"
          >
            {COUNTRIES.map(([c, n]) => (
              <option key={c} value={c}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="btn px-5 py-2 text-base" disabled={busy}>
          {busy ? 'Looking…' : 'Look up'}
        </button>
      </form>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        <span className="text-ink-faint">Try:</span>
        {EXAMPLES.map((x) => (
          <button
            key={x.q}
            type="button"
            onClick={() => {
              setQuery(x.q);
              setResults(null);
              pick(x.q);
            }}
            className="rounded-full border border-hairline-strong px-3 py-0.5 text-ink-muted hover:text-ink"
          >
            {x.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-5 border border-review/40 bg-review-soft px-3 py-2 text-sm text-review">{error}</p>}

      {results && results.length > 0 && (
        <PulsePanel title="Matching product codes" subtitle="Choose the line that best describes the product." className="mt-6">
          <ul className="divide-y divide-hairline">
            {results.map((r) => (
              <li key={r.htsno} className="py-2">
                <button type="button" onClick={() => pick(r.htsno)} className="flex w-full gap-3 text-left text-sm hover:text-accent">
                  <span className="w-28 shrink-0 font-mono tabular-nums text-ink">{r.htsno}</span>
                  <span className="text-ink-muted">
                    {r.description}
                    {r.general_rate ? <span className="text-ink-faint"> · general rate {r.general_rate}</span> : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </PulsePanel>
      )}

      {duty && (
        <PulsePanel
          title={`HTS ${duty.hts} from ${TARIFF_COUNTRY_LABELS[duty.country] ?? duty.country}`}
          subtitle={duty.description}
          className="mt-6"
        >
          <DutyStackTable lines={duty.lines} totalPct={duty.totalPct} htsCode={duty.hts} />
          <p className="mt-3 text-sm text-ink-muted">{duty.note}</p>
          <p className="mt-2 text-sm text-ink-muted">
            Also check: antidumping and countervailing duty orders on this product ({' '}
            <a href="https://aceservices.cbp.dhs.gov/adcvdweb" target="_blank" rel="noreferrer" className="text-accent hover:underline">
              CBP AD/CVD search
            </a>
            ), and binding rulings for similar goods (
            <a href={`https://rulings.cbp.gov/search?term=${encodeURIComponent(duty.hts.slice(0, 7))}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
              CBP rulings for {duty.hts.slice(0, 7)}
            </a>
            ). Follow new notices for this code:{' '}
            <a href={`/rss.xml?q=${encodeURIComponent(duty.hts.slice(0, 7))}&country=${duty.country}`} className="text-accent hover:underline">
              RSS
            </a>
            . For a full case with origin and party screening, use the{' '}
            <Link to="/calculator" className="text-accent hover:underline">
              calculator
            </Link>
            .
          </p>
        </PulsePanel>
      )}
    </div>
  );
}
