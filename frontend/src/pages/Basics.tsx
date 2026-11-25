import { Link, useLocation } from 'react-router-dom';
import { Breadcrumb } from '../components/Breadcrumb';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { langFromPath, localePath } from '../i18n/lang';
import { BASICS_EN } from '../i18n/content/basics.en';
import { BASICS_ES } from '../i18n/content/basics.es';
import { AboutBody } from './About';
import type { BasicsContent } from '../i18n/content/types';

const CONTENT: Record<'en' | 'es', BasicsContent> = { en: BASICS_EN, es: BASICS_ES };

export function Basics() {
  const lang = langFromPath(useLocation().pathname);
  const t = CONTENT[lang];
  return (
    <div className="mx-auto max-w-5xl px-4 py-10" lang={lang}>
      <Breadcrumb trail={[{ label: t.breadcrumbWire, to: '/' }, { label: t.breadcrumbBasics }]} />
      <h1 className="display mt-3 text-4xl text-ink sm:text-5xl">{t.h1}</h1>
      <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-muted">{t.intro}</p>
      <LanguageSwitch />
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {t.cards.map((c) => (
          <Link key={c.to} to={localePath(lang, c.to)} className="group block border border-hairline bg-paper-raised px-5 py-4 no-underline hover:border-accent">
            <p className="text-lg font-semibold text-ink group-hover:text-accent">{c.title} &rarr;</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-ink-muted">{c.text}</p>
          </Link>
        ))}
      </div>
      {lang === 'en' ? (
        <AboutBody />
      ) : (
        <p className="mt-10 text-sm text-ink-muted">
          <Link to="/basics#about" className="text-accent">About the site, its sources and limits (English)</Link>
        </p>
      )}
    </div>
  );
}
