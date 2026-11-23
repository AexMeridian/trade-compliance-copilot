import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Breadcrumb } from '../components/Breadcrumb';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { langFromPath, localePath } from '../i18n/lang';
import { GLOSSARY_EN } from '../i18n/content/glossary.en';
import { GLOSSARY_ES } from '../i18n/content/glossary.es';
import type { GlossaryContent } from '../i18n/content/types';

const CONTENT: Record<'en' | 'es', GlossaryContent> = { en: GLOSSARY_EN, es: GLOSSARY_ES };

export function Glossary() {
  const lang = langFromPath(useLocation().pathname);
  const t = CONTENT[lang];
  const [q, setQ] = useState('');
  const shown = t.terms.filter((x) => !q || `${x.term} ${x.def}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mx-auto max-w-3xl px-4 py-10" lang={lang}>
      <Breadcrumb trail={[{ label: t.breadcrumbBasics, to: localePath(lang, '/basics') }, { label: t.breadcrumbPage }]} />
      <h1 className="display mt-3 text-4xl text-ink sm:text-5xl">{t.h1}</h1>
      <p className="mt-3 text-base text-ink-muted">{t.intro}</p>
      <LanguageSwitch />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={t.filterPlaceholder}
        aria-label={t.filterLabel}
        className="mt-5 w-full border border-hairline-strong bg-paper-raised px-3 py-2 text-base text-ink outline-none focus:border-accent"
      />
      <dl className="mt-6 divide-y divide-hairline">
        {shown.map((x) => (
          <div key={x.id} id={x.id} className="py-4">
            <dt className="text-lg font-semibold text-ink">{x.term}</dt>
            <dd className="mt-1 text-base leading-relaxed text-ink-muted">
              {x.def}
              {x.link && (
                <>
                  {' '}
                  <Link to={localePath(lang, x.link.to)} className="text-accent hover:underline">
                    {x.link.label} &rarr;
                  </Link>
                </>
              )}
            </dd>
          </div>
        ))}
        {shown.length === 0 && <p className="py-4 text-ink-faint">{t.noMatch} "{q}".</p>}
      </dl>
    </div>
  );
}
