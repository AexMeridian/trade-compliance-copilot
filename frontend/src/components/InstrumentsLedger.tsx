import { useEffect, useState } from 'react';
import { getPower, type PowerIndicator } from '../lib/api';
import { formatValue, ordinal } from '../lib/powerFormat';
import { STATUS_LABEL } from '../lib/pulseCountries';
import type { PulseCountryDetail } from '../types/pulse';

// Both kinds of tools a state uses toward another, side by side: the pressure the United States has applied to this country
// (counted from this site's own policy records) and the support and ties that reach it (from the Power-profile indicators).
// Neither side is added up or netted against the other: a count of sanctioned parties and a dollar of aid are not the same
// unit, and the ledger says what each is, not what it adds up to.
const TIES = ['oda_received_usd', 'oda_received_pc', 'remittances_usd', 'un_dist_us', 'un_dist_cn'];

function Row({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="border-t border-hairline py-2.5 first:border-t-0">
      <dt className="text-[13px] text-ink-muted">{label}</dt>
      <dd>
        <span className="font-semibold tabular-nums text-ink">{value}</span>
        {note && <span className="block text-xs text-ink-faint">{note}</span>}
      </dd>
    </div>
  );
}

export function InstrumentsLedger({ code, name, data }: { code: string; name: string; data: PulseCountryDetail }) {
  const [ties, setTies] = useState<PowerIndicator[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    getPower([code])
      .then((r) => !cancelled && setTies(r.indicators.filter((i) => TIES.includes(i.id))))
      .catch(() => !cancelled && setTies([]));
    return () => {
      cancelled = true;
    };
  }, [code]);

  const { tariffs, sanctions, exportControl } = data;
  return (
    <section aria-labelledby="ledger-title" className="card min-w-0 px-4 pb-4 pt-4">
      <h2 id="ledger-title" className="text-[15px] font-semibold text-ink">
        Instruments toward {name}
      </h2>
      <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
        Pressure and support are listed side by side and never netted: a count of listed parties and a dollar of aid are different things.
      </p>
      <div className="mt-3 grid gap-x-10 gap-y-4 md:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">U.S. pressure</h3>
          <dl className="mt-1">
            <Row label="U.S. trade-policy actions naming it" value={data.actionsTotal.toLocaleString('en-US')} note="Federal Register notices, all time in this site's records" />
            {tariffs.forcedLabor && <Row label="Forced-labor tariff" value={`${tariffs.forcedLabor.ratePct}%`} note={tariffs.forcedLabor.legalBasis} />}
            {tariffs.extra.map((t) => (
              <Row key={t.legalBasis} label="Additional tariff" value={`${t.ratePct}%`} note={t.legalBasis} />
            ))}
            {tariffs.capped && <Row label="Capped tariff" value={`${tariffs.capped.ratePct}%`} note={tariffs.capped.legalBasis} />}
            {!tariffs.forcedLabor && tariffs.extra.length === 0 && !tariffs.capped && <Row label="Country-specific tariff programs" value="None recorded" />}
            <Row label="Parties on OFAC's sanctions list with an address here" value={sanctions.sdnCount === null ? 'n/a' : sanctions.sdnCount.toLocaleString('en-US')} />
            <Row label="Export-control status" value={STATUS_LABEL[exportControl.status]} />
          </dl>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">Support and ties</h3>
          {ties === null ? (
            <p className="mt-2 text-sm text-ink-faint">Loading…</p>
          ) : ties.length === 0 ? (
            <p className="mt-2 text-sm text-ink-faint">The country indicators are not available right now.</p>
          ) : (
            <dl className="mt-1">
              {ties.map((i) => {
                const s = i.standings[code];
                return (
                  <Row
                    key={i.id}
                    label={i.label}
                    value={s ? formatValue(i.unit, s.value) : 'n/a'}
                    note={s ? `${ordinal(s.rank)} of ${s.of}, ${s.year}${i.id.startsWith('oda_received') ? '. From all donors, not only the United States' : ''}` : undefined}
                  />
                );
              })}
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}
