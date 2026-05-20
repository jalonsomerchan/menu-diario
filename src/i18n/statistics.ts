import type { Locale } from '../config/site';
import en from './translations/statistics/en.json';
import es from './translations/statistics/es.json';

const translations = { es, en } as const satisfies Record<Locale, Record<string, string>>;

export type StatisticsTranslationKey = keyof typeof es;

export function useStatisticsTranslations(locale: Locale) {
  return function ts(key: StatisticsTranslationKey): string {
    return translations[locale]?.[key] ?? translations.es[key] ?? key;
  };
}
