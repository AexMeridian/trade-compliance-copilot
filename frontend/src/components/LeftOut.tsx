// Measures that practitioners expect on a soft-power page and that this site looked for and did not include, each with the
// reason. Saying so plainly is part of the method: a missing row never means a country scored zero. Update this list whenever a
// source is added, or a licence changes.
const LEFT_OUT: { measure: string; reason: string }[] = [
  {
    measure: 'World Heritage sites',
    reason: "UNESCO's terms for the World Heritage list limit reuse to non-commercial syndication and do not allow licensing the material. This site is run by a company, so it does not copy the list.",
  },
  {
    measure: 'Language reach and learning',
    reason: 'Only shared official language and colonial history with seven major powers is shown (CEPII). Language learning, the reach of a language beyond official status and Wikipedia editions have no open, reliable dataset we could verify; Wikidata, which we tested, lists Spanish as official in the United States and omits Russian in Kyrgyzstan.',
  },
  {
    measure: 'Peacekeeping contributions',
    reason: 'The UN publishes contributor figures only as an interactive chart and PDF reports. The one open database ends in 2012.',
  },
  {
    measure: 'Chinese overseas lending',
    reason: "AidData's country-level file is large and its reuse terms could not be confirmed, so it is not used.",
  },
  {
    measure: 'Where a country’s students go to study',
    reason: 'The data exist (UNESCO) but need about 200 requests per refresh, more than this site can make on its free hosting plan. Total students hosted and the net flow are shown instead.',
  },
  {
    measure: 'Public opinion beyond Pew and Afrobarometer',
    reason: 'Gallup and the Democracy Perception Index publish headline results but no confirmed right to reuse country tables. Latinobarómetro allows non-commercial use only, Arab Barometer’s files sit behind a registration form, and Asian Barometer is restricted to researchers. Pew’s questions on the UN, NATO, the EU and leaders are published but not yet entered here.',
  },
  {
    measure: 'Embassies, scholarships, film, music, sport and brands',
    reason: 'No open, comparable dataset covers all countries. Indices that claim to are built from paid surveys or undisclosed weights.',
  },
];

export function LeftOut() {
  return (
    <section aria-labelledby="left-out-title" className="card min-w-0 px-4 pb-4 pt-4">
      <h3 id="left-out-title" className="text-[15px] font-semibold text-ink">
        What we looked for and left out
      </h3>
      <p className="mt-1 max-w-3xl text-[13px] leading-relaxed text-ink-muted">
        A blank in a comparison is not a zero. These measures are missing on purpose, for the reasons given.
      </p>
      <dl className="mt-3 grid gap-x-8 gap-y-3 md:grid-cols-2">
        {LEFT_OUT.map((l) => (
          <div key={l.measure} className="min-w-0">
            <dt className="text-[13px] font-semibold text-ink">{l.measure}</dt>
            <dd className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{l.reason}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
