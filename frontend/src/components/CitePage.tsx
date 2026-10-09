import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { SITE } from '../lib/site';

// Ready-to-paste citations for whichever page is open, with today's retrieval date, because the data
// changes and a citation without that date is not reproducible. Built from the page's own title and
// URL; nothing is invented (no author is claimed beyond the publisher).
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function CitePage() {
  useLocation(); // re-render on navigation so the title and URL stay current
  const [copied, setCopied] = useState<string | null>(null);
  const now = new Date();
  const title = (document.title || SITE.name).replace(/\s*[|–—-]\s*Aex Terminal\s*$/i, '').trim() || SITE.name;
  const url = `${window.location.origin}${window.location.pathname}`;
  const year = now.getFullYear();
  const day = now.getDate();
  const month = MONTHS[now.getMonth()];
  const publisher = SITE.legalName || SITE.operator;
  const styles = [
    { id: 'APA', text: `${publisher}. (${year}). ${title}. ${SITE.name}. Retrieved ${month} ${day}, ${year}, from ${url}` },
    { id: 'Chicago', text: `${publisher}. "${title}." ${SITE.name}. Accessed ${month} ${day}, ${year}. ${url}.` },
  ];

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      window.setTimeout(() => setCopied(null), 2000);
    } catch {
      window.prompt('Copy this citation:', text);
    }
  }

  return (
    <details className="no-print mt-6 text-[13px]">
      <summary className="cursor-pointer font-semibold text-white">Cite this page</summary>
      <ul className="mt-3 space-y-3">
        {styles.map((s) => (
          <li key={s.id}>
            <p className="max-w-3xl break-words">{s.text}</p>
            <button type="button" onClick={() => copy(s.id, s.text)} className="mt-1 font-semibold text-white underline">
              {copied === s.id ? 'Copied' : `Copy ${s.id}`}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}
