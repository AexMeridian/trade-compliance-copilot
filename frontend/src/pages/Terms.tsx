import { Link } from 'react-router-dom';
import { SITE } from '../lib/site';

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="display mt-10 border-t-2 border-ink pt-4 text-2xl text-ink">{children}</h2>;
}

// Terms for a free, public, informational service operated by a Colorado LLC. Drafted to be read by
// laypeople: capitals are used only where the law expects conspicuous disclaimers. Counsel should
// review before any commercial launch, and this page and its date must change with the service.
export function Terms() {
  const co = SITE.legalName || SITE.operator;
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 text-sm leading-relaxed text-ink-muted">
      <h1 className="display text-4xl text-ink sm:text-5xl">Terms of use</h1>
      <p className="mt-3 text-base text-ink">
        These terms are an agreement between you and {co}
        {SITE.location ? `, a limited liability company organized in ${SITE.location.replace(', United States', '')}` : ''} ("we", "us"), the operator of{' '}
        {SITE.name}. By using the site, its feeds or its data endpoints you accept them; if you do not, please do not use the service. Last updated{' '}
        {SITE.termsUpdated}.
      </p>

      <H>1. Information only, not advice</H>
      <p className="mt-3">
        {SITE.name} publishes information drawn from public sources and, in the Compliance calculator (Beta), suggestions produced with the help of an AI
        model. None of it is legal, customs, tax, financial, investment or sanctions-compliance advice, and using the site does not create an
        attorney-client, broker-client, advisory or any other professional relationship. Do not rely on it for a filing, a screening or clearance decision, a
        transaction or an investment. Check the official source, which every item links to, and consult a qualified professional licensed in the relevant
        jurisdiction. Decisions you make are your own responsibility.
      </p>

      <H>2. No affiliation or endorsement</H>
      <p className="mt-3">
        {SITE.name} is an independent service. It is not affiliated with, endorsed by or operated on behalf of any government, agency or international
        organization, including those whose publications it reproduces or summarizes (for example the Federal Register, the Office of Foreign Assets
        Control, the Bureau of Industry and Security, the United Nations, the United Kingdom government, NATO and the International Monetary Fund). Their
        names identify their publications only. Names and boundaries are shown for reference and do not imply any position on the status of any territory.
        We take no position on any policy and make no recommendations.
      </p>

      <H>3. Accuracy and availability</H>
      <p className="mt-3">
        Sources can be delayed, revised, withdrawn or wrong, our automated labelling and matching make mistakes, and some information is a text match or an
        estimate as described on the{' '}
        <Link to="/methodology" className="text-accent">
          Methodology page
        </Link>
        . THE SERVICE AND ALL CONTENT ARE PROVIDED "AS IS" AND "AS AVAILABLE", WITHOUT WARRANTIES OF ANY KIND, EXPRESS, IMPLIED OR STATUTORY, INCLUDING
        WARRANTIES OF ACCURACY, COMPLETENESS, TIMELINESS, MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE AND NON-INFRINGEMENT. We may change,
        suspend or withdraw any part of the service at any time without notice, and we do not promise uninterrupted or error-free operation. Some places do
        not allow these exclusions, in which case they apply only as far as the law permits.
      </p>

      <H>4. The Compliance calculator (Beta)</H>
      <p className="mt-3">
        The calculator is a Beta tool. It stores what you enter for up to 30 days so you can return to your report, sends it to an AI service to produce
        suggestions, and may be wrong. Classification, origin and duty outputs are suggestions to be verified, not determinations, and a screening result is
        not a clearance: use the official OFAC Sanctions List Search and your own counsel. You are responsible for the accuracy of what you enter. Do not
        enter personal data, trade secrets, confidential or privileged business information, or anything you are not free to share with us and our service
        providers. A case can be opened by anyone who has its link; keep the link private.
      </p>

      <H>5. Acceptable use</H>
      <p className="mt-3">
        Use the site lawfully and reasonably. You agree not to: attempt to disrupt it or to bypass its rate limits, caps or security; probe it for
        vulnerabilities outside our{' '}
        <a href="/.well-known/security.txt" className="text-accent">
          disclosure policy
        </a>
        ; harvest it by automated means other than the public feeds and endpoints we publish (and then no faster than their caching allows); misrepresent
        our content or imply our endorsement; use the site to harass anyone, or to evade sanctions, export controls or other law; or submit unlawful content,
        malware or other people's personal data. We may block traffic or remove content that we reasonably believe breaks these terms or harms the service.
      </p>

      <H>6. Content, attribution and licences</H>
      <p className="mt-3">
        Data and publications belong to their publishers and are used under the terms listed on the{' '}
        <Link to="/methodology#sources" className="text-accent">
          Methodology page
        </Link>
        . Our own text, design, software and compilation are © {new Date().getFullYear()} {co}, all rights reserved except as stated here. You may quote short
        excerpts and cite figures for commentary, journalism, research and education with attribution and a link, and you may use the RSS, Atom and JSON feeds
        in a feed reader or a non-commercial aggregation that links back to the source. Contact us for any other reuse. Please cite the date you retrieved a
        figure, because data changes. If you submit feedback, you give us a non-exclusive, perpetual, royalty-free licence to use it to improve the service,
        without any obligation to you.
      </p>

      <H>7. Third-party sources and links</H>
      <p className="mt-3">
        The site links to and summarizes material from third parties. We do not control and are not responsible for their content, availability or terms,
        and a link is not an endorsement. If a third-party source changes its terms or asks us to stop using its material, we may remove it.
      </p>

      <H>8. Privacy</H>
      <p className="mt-3">
        How we handle data is described in the{' '}
        <Link to="/privacy" className="text-accent">
          Privacy policy
        </Link>
        , which forms part of these terms.
      </p>

      <H>9. Limitation of liability</H>
      <p className="mt-3">
        TO THE FULLEST EXTENT THE LAW ALLOWS, {co.toUpperCase()}, ITS MEMBERS, MANAGERS, OFFICERS, EMPLOYEES, CONTRACTORS AND SERVICE PROVIDERS WILL NOT BE
        LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY OR PUNITIVE DAMAGES, OR FOR LOST PROFITS, LOST DATA, LOST BUSINESS, REGULATORY
        PENALTIES OR TRADING LOSSES, ARISING FROM OR RELATED TO YOUR USE OF, OR INABILITY TO USE, THE SERVICE OR ITS CONTENT, WHATEVER THE LEGAL THEORY AND
        EVEN IF ADVISED OF THE POSSIBILITY. OUR TOTAL LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE IS LIMITED TO ONE HUNDRED U.S. DOLLARS (US$100).
        The service is free, and these limits reflect that. Nothing in these terms excludes or limits liability that cannot be excluded or limited by law,
        including liability for fraud or for death or personal injury caused by negligence.
      </p>

      <H>10. Indemnity</H>
      <p className="mt-3">
        To the extent the law allows, if you use the service unlawfully or in breach of these terms and a third party brings a claim against us as a result,
        you will reimburse the reasonable costs and losses we incur in dealing with it. This does not apply to consumers where the law does not permit it.
      </p>

      <H>11. Export controls and sanctions</H>
      <p className="mt-3">
        You may not use the service if you are barred from receiving it under United States law, or in breach of United States sanctions or export-control
        law. You are responsible for your own compliance with the laws that apply to you.
      </p>

      <H>12. Suspension and ending</H>
      <p className="mt-3">
        You may stop using the service at any time, and you can delete a calculator case from its report. We may suspend or end access for anyone who breaks
        these terms or whose use threatens the service. Sections that by their nature should survive (including sections 1, 3, 6, 9, 10, 12 and 13) do
        survive.
      </p>

      <H>13. Governing law and disputes</H>
      <p className="mt-3">{SITE.governingLaw}</p>
      <p className="mt-3">
        Before starting a formal claim, please write to us at the address below and give us 30 days to try to resolve the matter informally. Any claim must be
        brought within one year after it arose, to the extent the law allows a shorter period than the default.
      </p>

      <H>14. General</H>
      <p className="mt-3">
        These terms and the Privacy policy are the whole agreement between you and us about the service. If part of them is found unenforceable, the rest
        stays in force. Our not enforcing a right is not a waiver of it. You may not assign these terms; we may assign ours in a reorganization or sale of the
        business. We are not responsible for delay or failure caused by events beyond our reasonable control, including outages of our providers. Headings
        are for convenience only.
      </p>

      <H>15. Changes and contact</H>
      <p className="mt-3">
        We may update these terms; the date above shows the latest version. If a change is material we will say so on this page before it takes effect, and
        continued use afterwards means you accept it.
        {SITE.contactEmail && (
          <>
            {' '}
            Questions or notices:{' '}
            <a href={`mailto:${SITE.contactEmail}`} className="text-accent">
              {SITE.contactEmail}
            </a>
            , {co}
            {SITE.location ? `, ${SITE.location}` : ''}.
          </>
        )}
      </p>
    </main>
  );
}

export default Terms;
