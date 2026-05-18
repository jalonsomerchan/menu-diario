import type { Locale } from '../config/site';

const shoppingIntegrationTranslations = {
  es: {
    addToAlexa: 'Añadir a Alexa',
    alexaCopied: 'Orden para Alexa copiada. Abriendo Alexa...',
    alexaClipboardError: 'No se ha podido copiar la orden para Alexa.',
    alexaCommandPrefix: 'Añade a la lista de la compra',
  },
  en: {
    addToAlexa: 'Add to Alexa',
    alexaCopied: 'Alexa command copied. Opening Alexa...',
    alexaClipboardError: 'Could not copy the Alexa command.',
    alexaCommandPrefix: 'Add to my shopping list',
  },
} satisfies Record<Locale, Record<string, string>>;

export type ShoppingIntegrationTranslationKey = keyof (typeof shoppingIntegrationTranslations)['es'];

export function useShoppingIntegrationTranslations(locale: Locale) {
  return function tr(key: ShoppingIntegrationTranslationKey): string {
    return shoppingIntegrationTranslations[locale]?.[key] ?? shoppingIntegrationTranslations.es[key] ?? key;
  };
}
