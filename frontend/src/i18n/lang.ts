// Languages for the plain-language pages (/basics, /de-minimis, /glossary). English is the page of record. A language is added by
// (1) adding its code to LANGS, (2) adding one content file per page in i18n/content/ that satisfies the same types (the compiler then
// lists every missing key), and (3) adding it to the CONTENT maps in the three pages. Tagalog ('tl') is planned and NOT written yet.
export const LANGS = ['en', 'es'] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_NAME: Record<Lang, string> = { en: 'English', es: 'Español' };
export const LANG_PREFIX = '/es';

/** Pages that exist in more than one language. */
export const TRANSLATED_PATHS = ['/basics', '/de-minimis', '/glossary'] as const;

export function langFromPath(pathname: string): Lang {
  return pathname === LANG_PREFIX || pathname.startsWith(`${LANG_PREFIX}/`) ? 'es' : 'en';
}
/** The English path for any language's path. */
export function basePath(pathname: string): string {
  const p = langFromPath(pathname) === 'es' ? pathname.slice(LANG_PREFIX.length) || '/' : pathname;
  return p.length > 1 ? p.replace(/\/+$/, '') : p;
}
export function localePath(lang: Lang, path: string): string {
  return lang === 'es' && (TRANSLATED_PATHS as readonly string[]).includes(path) ? `${LANG_PREFIX}${path}` : path;
}

/** Shown on every translated page. The English page controls. */
export const TRANSLATION_NOTE: Record<Lang, string | null> = {
  en: null,
  es: 'Este texto es una traducción. Si hay alguna diferencia, la página en inglés es la que vale. Las cifras, los términos legales y las fuentes son los mismos que en inglés.',
};
