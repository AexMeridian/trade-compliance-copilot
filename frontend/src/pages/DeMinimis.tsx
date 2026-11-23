import { Link, useLocation } from 'react-router-dom';
import { Breadcrumb } from '../components/Breadcrumb';
import { PulsePanel } from '../components/PulsePanel';
import { LanguageSwitch } from '../components/LanguageSwitch';
import { langFromPath, localePath } from '../i18n/lang';
import { DEMINIMIS_EN } from '../i18n/content/deminimis.en';
import { DEMINIMIS_ES } from '../i18n/content/deminimis.es';
import type { DeMinimisContent } from '../i18n/content/types';

// The text lives in i18n/content (English is the page of record; Spanish is a translation). This file only lays it out.
const CONTENT: Record<'en' | 'es', DeMinimisContent> = { en: DEMINIMIS_EN, es: DEMINIMIS_ES };
const KNOW_BEFORE_YOU_GO = 'https://www.cbp.gov/travel/us-citizens/know-before-you-go';
const ext = 'text-accent hover:underline';

export function DeMinimis() {
  const lang = langFromPath(useLocation().pathname);
  const t = CONTENT[lang];
  return (
    <div className="mx-auto max-w-3xl px-4 py-10" lang={lang}>
      <Breadcrumb trail={[{ label: t.breadcrumbBasics, to: localePath(lang, '/basics') }, { label: t.breadcrumbPage }]} />
      <h1 className="display mt-3 text-4xl text-ink sm:text-5xl">{t.h1}</h1>
      <p className="mt-4 text-lg leading-relaxed text-ink-muted">{t.intro}</p>
      <LanguageSwitch />

      <PulsePanel title={t.inShortTitle} className="mt-6">
        <ul className="list-disc space-y-2 pl-5 text-base text-ink">
          {t.inShort.map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      </PulsePanel>

      <PulsePanel title={t.timelineTitle} className="mt-6">
        <ol className="flex flex-col gap-3">
          {t.timeline.map((x) => (
            <li key={x.date} className="grid grid-cols-[7.5rem_minmax(0,1fr)] gap-3 text-base">
              <span className="font-semibold text-ink">{x.date}</span>
              <span className="text-ink-muted">
                {x.text}{' '}
                <a href={x.href} target="_blank" rel="noreferrer" className={`text-sm ${ext}`}>
                  {t.sourcePrefix} {x.source}
                </a>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-ink-muted">
          {t.noticesBefore}{' '}
          <Link to="/?tab=policy&q=de%20minimis" className={ext}>
            {t.noticesLink}
          </Link>
          .
        </p>
      </PulsePanel>

      <PulsePanel title={t.travelersTitle} className="mt-6">
        <p className="text-base text-ink-muted">{t.travelersIntro}</p>
        <ul className="mt-3 flex flex-col gap-3">
          {t.travelers.map((x) => (
            <li key={x.text} className="border-l-2 border-hairline-strong pl-3 text-base text-ink">
              {x.text}{' '}
              <a href={x.href} target="_blank" rel="noreferrer" className={`block text-sm ${ext}`}>
                {t.sourcePrefix} {x.source} ({x.href.replace('https://', '')}). {t.travelersChecked} {t.travelersCheckedOn}.
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-ink-muted">
          <a href={KNOW_BEFORE_YOU_GO} target="_blank" rel="noreferrer" className={ext}>
            {t.travelersMore}
          </a>
        </p>
      </PulsePanel>

      <PulsePanel title={t.lookupTitle} className="mt-6">
        <p className="text-base text-ink-muted">
          {t.lookupBefore}{' '}
          <Link to="/lookup" className={`font-semibold ${ext}`}>
            {t.lookupLink}
          </Link>{' '}
          {t.lookupAfter}
        </p>
      </PulsePanel>

      <PulsePanel title={t.abroadTitle} className="mt-6">
        <p className="text-base text-ink-muted">{t.abroadIntro}</p>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-base text-ink-muted">
          {[t.canada, t.uk].map((x) => (
            <li key={x.label}>
              <span className="font-semibold text-ink">{x.label}</span> {x.text}{' '}
              <a href={x.href} target="_blank" rel="noreferrer" className={ext}>
                {x.linkText}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-ink-muted">
          {t.exportNote}{' '}
          <a href={t.exportHref} target="_blank" rel="noreferrer" className={ext}>
            {t.exportLinkText}
          </a>
        </p>
      </PulsePanel>

      <p className="mt-6 text-sm text-ink-faint">{t.disclaimer}</p>
    </div>
  );
}
