// Measures that practitioners expect on a soft-power page and that this site looked for and did not include, each with the
// reason. Saying so plainly is part of the method: a missing row never means a country scored zero. Update this list whenever a
// source is added, or a licence changes.
type Why = 'Licence' | 'No open data' | 'Not yet entered' | 'Too large for the free plan';

const WHY_STYLE: Record<Why, string> = {
  Licence: 'bg-hard-tint text-hard',
  'No open data': 'bg-hairline text-ink-muted',
  'Not yet entered': 'bg-soft-tint text-soft',
  'Too large for the free plan': 'bg-hairline text-ink-muted',
};

const LEFT_OUT: { measure: string; why: Why; reason: string }[] = [
  {
    measure: 'World Heritage sites',
    why: 'Licence',
    reason: "UNESCO's terms for the World Heritage list limit reuse to non-commercial syndication and do not allow licensing the material. This site is run by a company, so it does not copy the list.",
  },
  {
    measure: 'Language reach and learning',
    why: 'No open data',
    reason: 'Only shared official language and colonial history with seven major powers is shown (CEPII). Language learning, the reach of a language beyond official status and Wikipedia editions have no open, reliable dataset we could verify; Wikidata, which we tested, lists Spanish as official in the United States and omits Russian in Kyrgyzstan.',
  },
  {
    measure: 'Peacekeeping contributions',
    why: 'No open data',
    reason: 'The UN publishes contributor figures only as an interactive chart and PDF reports. The one open database ends in 2012.',
  },
  {
    measure: 'Chinese overseas lending',
    why: 'Licence',
    reason: "AidData's country-level file is large and its reuse terms could not be confirmed, so it is not used.",
  },
  {
    measure: 'Where a country’s students go to study',
    why: 'Too large for the free plan',
    reason: 'The data exist (UNESCO) but need about 200 requests per refresh, more than this site can make on its free hosting plan. Total students hosted and the net flow are shown instead.',
  },
  {
    measure: 'Public opinion beyond Pew and Afrobarometer',
    why: 'Licence',
    reason: 'Gallup and the Democracy Perception Index publish headline results but no confirmed right to reuse country tables. Latinobarómetro allows non-commercial use only, Arab Barometer’s files sit behind a registration form, and Asian Barometer is restricted to researchers.',
  },
  {
    measure: 'Pew’s questions on the UN, NATO, the EU and leaders',
    why: 'Not yet entered',
    reason: 'Published in Pew’s reports as charts. They need careful, checked entry before they can be shown, so they are not here yet.',
  },
  {
    measure: 'Embassies, scholarships, film, music, sport and brands',
    why: 'No open data',
    reason: 'No open, comparable dataset covers all countries. Indices that claim to are built from paid surveys or undisclosed weights.',
  },
];

export function LeftOut() {
  return (
    <section aria-labelledby="left-out-title" className="min-w-0">
      <h3 id="left-out-title" className="text-[15px] font-semibold text-ink">
        What we looked for and left out
      </h3>
      <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-muted">A blank in a comparison is not a zero. These measures are missing on purpose, for the reasons given.</p>
      <ul className="mt-3 grid gap-3 md:grid-cols-2">
        {LEFT_OUT.map((l) => (
          <li key={l.measure} className="card min-w-0 p-3.5">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[14px] font-semibold leading-snug text-ink">{l.measure}</p>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${WHY_STYLE[l.why]}`}>{l.why}</span>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{l.reason}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
