import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getPulseCountry } from '../lib/api';
import { PulsePanel } from '../components/PulsePanel';
import { TARIFF_COUNTRY_LABELS } from '../lib/pulseTariffCountries';
import { freightNoteFor } from '../lib/freightNotes';
import type { PulseCountryDetail } from '../types/pulse';

const MAX_COUNTRIES = 3;
const DEFAULT_CODES = ['CN', 'MX'];

const EXPORT_STATUS_LABEL: Record<PulseCountryDetail['exportControl']['status'], string> = {
  curated: 'Verified export-control status',
  comprehensive_embargo: 'Comprehensively embargoed',
  broad_restriction_746_5: 'Near-comprehensive license requirement',
  not_curated: 'Not yet verified by this app',
};

const SORTED_CODES = Object.keys(TARIFF_COUNTRY_LABELS).sort((a, b) => TARIFF_COUNTRY_LABELS[a].localeCompare(TARIFF_COUNTRY_LABELS[b]));

function parseCodes(raw: string | null): string[] {
  if (!raw) return DEFAULT_CODES;
  const codes = raw
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter((c) => TARIFF_COUNTRY_LABELS[c])
    .slice(0, MAX_COUNTRIES);
  return codes.length ? codes : DEFAULT_CODES;
}

// A procurement reader comparing sourcing options wants this exact view --
// "which of these countries carries which tariff program, and roughly how
// does the shipping lane differ" -- side by side, without opening three
// separate country pages and holding the differences in their head. Built
// entirely from src/routes/pulse.ts's existing /pulse/country/:code (called
// here 2-3 times in parallel), so no backend change was needed for this page.
export function CountryCompare() {
  const [params, setParams] = useSearchParams();
  const codes = parseCodes(params.get('countries'));
  const [data, setData] = useState<Record<string, PulseCountryDetail | 'error'>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(
      codes.map((code) =>
        getPulseCountry(code, TARIFF_COUNTRY_LABELS[code])
          .then((d) => [code, d] as const)
          .catch(() => [code, 'error'] as const)
      )
    ).then((results) => {
      if (cancelled) return;
      setData(Object.fromEntries(results));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [codes.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  function setCodeAt(i: number, code: string) {
    const next = [...codes];
    next[i] = code;
    const next_ = new URLSearchParams(params);
    next_.set('countries', next.join(','));
    setParams(next_, { replace: true });
  }

  function addSlot() {
    const unused = SORTED_CODES.find((c) => !codes.includes(c));
    if (!unused || codes.length >= MAX_COUNTRIES) return;
    const next = new URLSearchParams(params);
    next.set('countries', [...codes, unused].join(','));
    setParams(next, { replace: true });
  }

  function removeSlot(i: number) {
    if (codes.length <= 2) return; // always compare at least two
    const next = new URLSearchParams(params);
    next.set(
      'countries',
      codes.filter((_, idx) => idx !== i).join(',')
    );
    setParams(next, { replace: true });
  }

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="display text-4xl text-ink sm:text-5xl">Compare countries</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
        Tariff-program exposure, export-control status and a typical shipping lane, side by side -- the same real, sourced data as each country's own page.
        This link is shareable as-is; the countries you pick are saved in the URL, not an account.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {codes.map((code, i) => (
          <span key={i} className="flex items-center gap-1">
            <select
              value={code}
              onChange={(e) => setCodeAt(i, e.target.value)}
              className="border border-hairline-strong bg-paper-raised px-2 py-1.5 text-sm outline-none focus:border-accent"
            >
              {SORTED_CODES.map((c) => (
                <option key={c} value={c}>
                  {TARIFF_COUNTRY_LABELS[c]}
                </option>
              ))}
            </select>
            {codes.length > 2 && (
              <button type="button" onClick={() => removeSlot(i)} aria-label={`Remove ${TARIFF_COUNTRY_LABELS[code]}`} className="text-ink-faint hover:text-stop">
                &times;
              </button>
            )}
          </span>
        ))}
        {codes.length < MAX_COUNTRIES && (
          <button type="button" onClick={addSlot} className="btn text-sm">
            Add a country
          </button>
        )}
      </div>

      {loading && codes.every((c) => !data[c]) ? (
        <p className="mt-10 text-sm text-ink-faint">Loading…</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {codes.map((code) => {
            const d = data[code];
            if (!d) return null;
            if (d === 'error') {
              return (
                <PulsePanel key={code} title={TARIFF_COUNTRY_LABELS[code]}>
                  <p className="text-sm text-ink-faint">Couldn't load data for this country.</p>
                </PulsePanel>
              );
            }
            const freight = freightNoteFor(code);
            return (
              <PulsePanel key={code} title={TARIFF_COUNTRY_LABELS[code]} className="min-w-0">
                <div className="flex flex-col gap-4 text-sm">
                  <div>
                    <p className="font-semibold text-ink">Tariff programs</p>
                    <ul className="mt-1 flex flex-col gap-1.5 text-ink-muted">
                      {d.tariffs.forcedLabor && <li>Section 301 forced-labor determination: {d.tariffs.forcedLabor.ratePct}%.</li>}
                      {d.tariffs.extra.map((e, i) => (
                        <li key={i}>Section 338 extra duty: {e.ratePct}% ({e.note}).</li>
                      ))}
                      {d.tariffs.capped && (
                        <li>
                          Section 232 metals cap: {d.tariffs.capped.ratePct}% (standard {d.tariffs.capped.standardPct}%).
                        </li>
                      )}
                      {!d.tariffs.forcedLabor && d.tariffs.extra.length === 0 && !d.tariffs.capped && <li>No country-specific tariff program applies right now.</li>}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-ink">Export control</p>
                    <p className="mt-1 text-ink-muted">{EXPORT_STATUS_LABEL[d.exportControl.status]}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-ink">Sanctioned-entity mentions</p>
                    <p className="mt-1 text-ink-muted">
                      {d.sanctions.sdnCount ?? 0} SDN, {d.sanctions.cslCount ?? 0} Commerce/State list
                    </p>
                  </div>
                  {freight && (
                    <div>
                      <p className="font-semibold text-ink">Typical shipping lane</p>
                      <p className="mt-1 text-ink-muted">
                        {freight.mode}, typically {freight.transitRange}.
                      </p>
                    </div>
                  )}
                  <Link to={`/country/${code}`} className="text-xs text-accent hover:underline">
                    Full country page &rarr;
                  </Link>
                </div>
              </PulsePanel>
            );
          })}
        </div>
      )}
    </main>
  );
}
