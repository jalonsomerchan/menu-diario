import type { Locale } from '../config/site';

const planningTranslations = {
  es: {
    nav: 'Planificación',
    title: 'Planificación',
    hint: 'Organiza los próximos días',
  },
  en: {
    nav: 'Planning',
    title: 'Planning',
    hint: 'Plan the upcoming days',
  },
} satisfies Record<Locale, Record<'nav' | 'title' | 'hint', string>>;

export type PlanningTranslationKey = keyof (typeof planningTranslations)['es'];

export function usePlanningTranslations(locale: Locale) {
  return function tp(key: PlanningTranslationKey): string {
    return planningTranslations[locale]?.[key] ?? planningTranslations.es[key] ?? key;
  };
}
