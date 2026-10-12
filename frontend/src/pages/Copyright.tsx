import { Link } from 'react-router-dom';
import { SITE } from '../lib/site';

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="display mt-10 border-t-2 border-ink pt-4 text-2xl text-ink">{children}</h2>;
}

// Copyright notice and a takedown route for rights holders. Informal until a DMCA agent is registered with the U.S. Copyright Office
// (17 U.S.C. 512(c)(2)); then add the agent's name and address here and in docs/OPERATIONS.md.
export function Copyright() {
  const co = SITE.legalName || SITE.operator;
  const mail = SITE.contactEmail;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-sm leading-relaxed text-ink-muted">
      <h1 className="display text-4xl text-ink sm:text-5xl">Copyright and takedown requests</h1>
      <p className="mt-3 text-base text-ink">
        We respect the rights of publishers and creators, and we link to sources rather than copying them. Last updated {SITE.copyrightUpdated}.
      </p>

      <H>Our content</H>
      <p className="mt-3">
        The design, text, software and compilation of {SITE.name} are &copy; {new Date().getFullYear()} {co}. The name {SITE.name} and its logo are our
        trademarks. You may quote short excerpts with attribution and a link, as the{' '}
        <Link to="/terms" className="text-accent">
          Terms of use
        </Link>{' '}
        describe.
      </p>

      <H>Other people's content</H>
      <p className="mt-3">
        Government publications, statistics and open datasets are used under their own terms, listed on the{' '}
        <Link to="/methodology#sources" className="text-accent">
          Methodology page
        </Link>
        . For news we show a headline, a link and a short summary, and send you to the publisher. We do not show publishers' photographs or full articles.
      </p>

      <H>Asking us to remove something</H>
      <p className="mt-3">
        If you own or represent the owner of material shown here and believe it should not be, email {mail ? (
          <a href={`mailto:${mail}`} className="text-accent">
            {mail}
          </a>
        ) : (
          'us'
        )}{' '}
        with the subject "Copyright notice" and include:
      </p>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>Your name and contact details, and the name of the owner if you act for someone else.</li>
        <li>The work you say is affected, and the address (URL) of the page here where it appears.</li>
        <li>What you want us to do (for example remove an item or stop using a feed).</li>
        <li>A statement that you believe in good faith that the use is not authorized by the owner, its agent or the law.</li>
        <li>A statement that the information is accurate and, under penalty of perjury, that you are the owner or authorized to act for the owner.</li>
        <li>Your signature (typing your full name is enough).</li>
      </ul>
      <p className="mt-3">
        We act promptly on a complete notice, which may include removing the item or feed while we look into it, and we may pass your notice to the person
        responsible. Knowingly false claims can carry legal liability. If you think we removed something by mistake, tell us and we will review it.
      </p>

      <H>Repeat infringement</H>
      <p className="mt-3">
        The site has no user accounts and accepts no uploads, so it hosts no user-posted files. If that changes, we will adopt a repeat-infringer policy and
        publish the details here.
      </p>
    </div>
  );
}

export default Copyright;
