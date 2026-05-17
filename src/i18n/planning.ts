import type { Locale } from '../config/site';

const planningTranslations = {
  es: {
    nav: 'Planificador IA',
    title: 'Planificador IA',
    hint: 'Configura el rango y deja que la IA proponga',
  },
  en: {
    nav: 'AI Planner',
    title: 'AI Planner',
    hint: 'Set the range and let AI propose meals',
  },
} satisfies Record<Locale, Record<'nav' | 'title' | 'hint', string>>;

export type PlanningTranslationKey = keyof (typeof planningTranslations)['es'];

export function usePlanningTranslations(locale: Locale) {
  return function tp(key: PlanningTranslationKey): string {
    return planningTranslations[locale]?.[key] ?? planningTranslations.es[key] ?? key;
  };
}
