import { defaultLocale, type Locale } from '../config/site';

const translations = {
  es: {
    action: 'WhatsApp',
    empty: 'No hay productos marcados como comprar para enviar por WhatsApp.',
    title: 'Lista de la compra',
    shared: 'Abriendo WhatsApp con la lista de compra.',
  },
  en: {
    action: 'WhatsApp',
    empty: 'There are no items marked as buy to send through WhatsApp.',
    title: 'Shopping list',
    shared: 'Opening WhatsApp with the shopping list.',
  },
} as const;

export type ShoppingWhatsappTranslationKey = keyof typeof translations.es;

export function useShoppingWhatsappTranslations(locale: Locale | 'es' | 'en') {
  const current = translations[locale as Locale] ?? translations[defaultLocale];

  return function shoppingWhatsappT(key: ShoppingWhatsappTranslationKey) {
    return current[key] ?? translations[defaultLocale][key] ?? key;
  };
}
