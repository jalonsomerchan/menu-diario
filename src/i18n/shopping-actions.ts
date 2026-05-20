import type { Locale } from '../config/site';

const translations = {
  es: {
    doNotBuy: 'No comprar',
  },
  en: {
    doNotBuy: 'Do not buy',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export function useShoppingActionTranslations(locale: Locale) {
  return function ta(key: keyof typeof translations.es): string {
    return translations[locale]?.[key] ?? translations.es[key] ?? key;
  };
}
