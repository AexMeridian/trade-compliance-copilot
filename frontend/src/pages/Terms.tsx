import { Link } from 'react-router-dom';
import { SITE } from '../lib/site';

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="display mt-10 border-t-2 border-ink pt-4 text-2xl text-ink">{children}</h2>;
}

// Plain-language terms for a free, public, informational service. Clauses that depend on facts
// only the operator can supply (legal entity, governing law) appear only once those fields are set
// in lib/site.ts; nothing is invented. Have counsel review before a commercial launch.
export function Terms() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-sm leading-relaxed text-ink-muted">
      <h1 className="display text-4xl text-ink sm:text-5xl">Terms of use</h1>
      <p className="mt-3 text-base text-ink">
        These terms govern your use of {SITE.name}, operated by {SITE.legalName || SITE.operator}. By using the site you accept them. Last updated {SITE.termsUpdated}.
      </p>

      <H>Information only, not advice</H>
      <p className="mt-3">
        {SITE.name} publishes information drawn from public sources, and in the Compliance calculator (Beta) suggestions produced with the help of an AI
        model. None of it is legal, customs, tax, financial, investment or sanctions-compliance advice, and using the site does not create a lawyer-client,
        broker-client or any other professional relationship. Do not rely on it for a filing, a screening or clearance decision, a transaction or an
        investment. Check the official source, which every item links to, and consult a qualified professional.
      </p>

      <H>No affiliation</H>
      <p className="mt-3">
        {SITE.name} is an independent service. It is not affiliated with, endorsed by or operated on behalf of any government, agency or international
        organization, including those whose publications it reproduces or summarizes (for example the Federal Register, OFAC, the Bureau of Industry and
        Security, the United Nations, the United Kingdom government, NATO and the IMF). Their names identify their publications only.
      </p>

      <H>Accuracy and availability</H>
      <p className="mt-3">
        Sources can be delayed, revised, withdrawn or wrong, our automated labelling and matching make mistakes, and some information is a text match or an
        estimate as described on the{' '}
        <Link to="/methodology" className="text-accent">
          Methodology page
        </Link>
        . The service is provided "as is" and "as available", without warranties of any kind, express or implied, including accuracy, completeness,
        fitness for a particular purpose and non-infringement. We may change, suspend or withdraw any part of it at any time.
      </p>

      <H>Limitation of liability</H>
      <p className="mt-3">
        To the fullest extent the law allows, {SITE.operator} and the people who work on {SITE.name} are not liable for any loss or damage arising from
        your use of, or inability to use, the site or its content, including indirect, incidental or consequential loss, lost profit, or penalties imposed
        by any authority. Nothing in these terms limits liability that cannot be limited by law.
      </p>

      <H>The Compliance calculator</H>
      <p className="mt-3">
        The calculator is a Beta tool. It stores what you enter for up to 30 days so you can return to your report, sends it to an AI service to produce
        suggestions, and may be wrong. Do not enter personal data, confidential business information or anything you are not free to share. A case can be
        opened by anyone who has its link. Screening results are not a clearance: use the official OFAC Sanctions List Search and your own counsel.
      </p>

      <H>Acceptable use</H>
      <p className="mt-3">
        Use the site lawfully and reasonably. Do not attempt to disrupt it, bypass its rate limits or security, probe it for vulnerabilities outside our{' '}
        <a href="/.well-known/security.txt" className="text-accent">
          disclosure policy
        </a>
        , harvest it by automated means other than the public feeds and endpoints we publish (and then no faster than their caching allows), or use it to
        harass anyone or to evade sanctions or export controls. We may block abusive traffic.
      </p>

      <H>Content, attribution and licences</H>
      <p className="mt-3">
        Data and publications belong to their publishers and are used under the terms listed on the{' '}
        <Link to="/methodology#sources" className="text-accent">
          Methodology page
        </Link>
        . Our own text, design and software are © {new Date().getFullYear()} {SITE.operator}. You may quote short excerpts for commentary, research and
        education with attribution and a link; contact us for other reuse. Please cite the date you retrieved a figure, because data changes.
      </p>

      <H>Privacy</H>
      <p className="mt-3">
        How we handle data is described in the{' '}
        <Link to="/privacy" className="text-accent">
          Privacy policy
        </Link>
        .
      </p>

      {SITE.governingLaw && (
        <>
          <H>Governing law</H>
          <p className="mt-3">{SITE.governingLaw}</p>
        </>
      )}

      <H>Changes and contact</H>
      <p className="mt-3">
        We may update these terms; the date above shows the latest version, and continued use means you accept it.
        {SITE.contactEmail && (
          <>
            {' '}
            Questions: <a href={`mailto:${SITE.contactEmail}`} className="text-accent">{SITE.contactEmail}</a>.
          </>
        )}
      </p>
    </main>
  );
}

export default Terms;
