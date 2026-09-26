import { Link } from 'react-router-dom';

export function NotFound() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="display text-4xl text-ink">We can't find that page</h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-muted">The link may be old or mistyped. Here are some good places to start:</p>
      <ul className="mt-4 space-y-2 text-sm">
        <li>
          <Link to="/" className="text-accent">
            Trade Policy Pulse
          </Link>
          <span className="text-ink-faint">: what's changing in world trade today</span>
        </li>
        <li>
          <Link to="/?tab=guide" className="text-accent">
            Guide for newcomers
          </Link>
          <span className="text-ink-faint">: how to read the page</span>
        </li>
        <li>
          <Link to="/calculator" className="text-accent">
            Compliance calculator
          </Link>
          <span className="text-ink-faint">: work through a shipment</span>
        </li>
      </ul>
    </main>
  );
}
