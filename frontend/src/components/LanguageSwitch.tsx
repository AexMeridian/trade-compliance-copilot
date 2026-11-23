import { Link, useLocation } from 'react-router-dom';
import { LANGS, LANG_NAME, TRANSLATION_NOTE, basePath, langFromPath, localePath, type Lang } from '../i18n/lang';

// A visible language switch for the pages that have a translation, with the note that the English page controls. Each link carries
// lang/hreflang so assistive technology reads the name in its own language. The page head's hreflang links are written by lib/pageMeta.ts.
export function LanguageSwitch() {
  const { pathname, search, hash } = useLocation();
  const current = langFromPath(pathname);
  const base = basePath(pathname);
  return (
    <div className="mt-4">
      <nav aria-label="Language / Idioma" className="flex flex-wrap items-center gap-2 text-sm">
        {LANGS.map((l: Lang) =>
          l === current ? (
            <span key={l} lang={l} aria-current="true" className="border border-ink bg-ink px-2.5 py-1 font-semibold text-paper">
              {LANG_NAME[l]}
            </span>
          ) : (
            <Link key={l} to={`${localePath(l, base)}${search}${hash}`} lang={l} hrefLang={l} className="border border-hairline-strong px-2.5 py-1 font-semibold text-ink-muted no-underline hover:border-accent hover:text-accent">
              {LANG_NAME[l]}
            </Link>
          )
        )}
      </nav>
      {TRANSLATION_NOTE[current] && (
        <p role="note" className="mt-3 border-l-2 border-hairline-strong bg-paper-raised px-3 py-2 text-sm text-ink-muted">
          {TRANSLATION_NOTE[current]}
        </p>
      )}
    </div>
  );
}
