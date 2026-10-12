import { Link } from 'react-router-dom';
import { SITE } from '../lib/site';

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="display mt-10 border-t-2 border-ink pt-4 text-2xl text-ink">{children}</h2>;
}

// Human-readable companion to /.well-known/security.txt. Keep the scope and promises here in step with that file.
export function Security() {
  const mail = SITE.contactEmail;
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 text-sm leading-relaxed text-ink-muted">
      <h1 className="display text-4xl text-ink sm:text-5xl">Security and responsible disclosure</h1>
      <p className="mt-3 text-base text-ink">
        If you find a security problem in {SITE.name}, we want to hear about it. Last updated {SITE.securityUpdated}.
      </p>

      <H>How to report</H>
      <p className="mt-3">
        Email{' '}
        {mail ? (
          <a href={`mailto:${mail}`} className="text-accent">
            {mail}
          </a>
        ) : (
          'us'
        )}{' '}
        with the subject "Security report". Say what you found, the steps to reproduce it and what you think the impact is. Please do not include other people's
        personal data. Our machine-readable policy is at{' '}
        <a href="/.well-known/security.txt" className="text-accent">
          /.well-known/security.txt
        </a>
        .
      </p>

      <H>What to expect</H>
      <ul className="mt-3 list-disc space-y-2 pl-5">
        <li>We aim to acknowledge a report within 5 business days and to keep you informed until it is fixed.</li>
        <li>Please give us a reasonable time to fix a problem before you publish it, and we will credit you if you wish.</li>
        <li>We do not run a bug bounty and cannot offer payment.</li>
      </ul>

      <H>Safe harbor</H>
      <p className="mt-3">
        If you act in good faith, stay within this policy and avoid harm, we will not take legal action against you for your research. Good faith means you:
        test only with your own data, stop as soon as you confirm a problem, do not access, change or keep data that is not yours, do not disrupt the service
        (no denial-of-service, spam or load testing), and do not use social engineering or physical attacks against anyone.
      </p>

      <H>In scope</H>
      <p className="mt-3">
        The website and API at aexterminal.com, including the Compliance calculator. Problems in other companies' services (for example Cloudflare or Anthropic)
        should be reported to them. Reports that are usually out of scope: missing best-practice headers with no demonstrated impact, results from automated
        scanners without a working example, and issues that need a rooted or already compromised device.
      </p>

      <H>How we protect the site</H>
      <p className="mt-3">
        Encrypted connections only (HTTPS with HSTS), a strict content security policy, no third-party scripts, no cookies, limits on request size and rate,
        parameterised database queries, and calculator data that expires after 30 days. Details of what we collect are in the{' '}
        <Link to="/privacy" className="text-accent">
          Privacy policy
        </Link>
        .
      </p>
    </div>
  );
}

export default Security;
