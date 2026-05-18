import { defaultLocale, locales, type Locale } from '../config/site';
import { joinPathSegments, stripBasePath, withBasePath } from '../utils/paths';
import en from './translations/en.json';
import enHistory from './translations/history/en.json';
import enPublic from './translations/public/en.json';
import enSettings from './translations/settings/en.json';
import es from './translations/es.json';
import esHistory from './translations/history/es.json';
import esPublic from './translations/public/es.json';
import esSettings from './translations/settings/es.json';

function namespaceTranslations(namespace: string, values: Record<string, string>) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [`${namespace}.${key}`, value]));
}

const esTranslations = {
  ...es,
  ...namespaceTranslations('history', esHistory),
  ...namespaceTranslations('settings', esSettings),
  ...namespaceTranslations('public', esPublic),
};

const enTranslations: typeof esTranslations = {
  ...en,
  ...namespaceTranslations('history', enHistory),
  ...namespaceTranslations('settings', enSettings),
  ...namespaceTranslations('public', enPublic),
};

export type TranslationKey = keyof typeof esTranslations;

const translations: Record<Locale, typeof esTranslations> = {
  es: esTranslations,
  en: enTranslations,
};

export function isLocale(locale: string | undefined): locale is Locale {
  return Boolean(locale && locales.includes(locale as Locale));
}

export function getLocaleFromUrl(pathname: string): Locale {
  const pathnameWithoutBase = stripBasePath(pathname);
  const [, maybeLocale] = pathnameWithoutBase.split('/');

  if (isLocale(maybeLocale)) {
    return maybeLocale;
  }

  return defaultLocale;
}

export function useTranslations(locale: Locale) {
  return function t(key: TranslationKey): string {
    return translations[locale]?.[key] ?? translations[defaultLocale][key] ?? key;
  };
}

export function getLocalizedPath(path: string, locale: Locale): string {
  const cleanPath = path.replace(/^\//, '');

  if (locale === defaultLocale) {
    return withBasePath(cleanPath);
  }

  return withBasePath(joinPathSegments(locale, cleanPath));
}

export function getUnlocalizedPath(pathname: string): string {
  const pathnameWithoutBase = stripBasePath(pathname);
  const segments = pathnameWithoutBase.split('/').filter(Boolean);

  if (isLocale(segments[0])) {
    segments.shift();
  }

  return segments.length ? joinPathSegments(...segments) : '/';
}

export function getLocalizedEquivalentPath(pathname: string, locale: Locale): string {
  return getLocalizedPath(getUnlocalizedPath(pathname), locale);
}

export function getAlternateLocales(currentLocale: Locale) {
  return locales.filter((locale) => locale !== currentLocale);
}
