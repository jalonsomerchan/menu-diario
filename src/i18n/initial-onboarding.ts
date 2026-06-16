import { defaultLocale, type Locale } from '../config/site';

const translations = {
  es: {
    title: 'Configura MenuDiario en 2 minutos',
    description: 'Te dejamos tres primeros pasos para que la app empiece a recomendar y organizar mejor tus comidas.',
    stepMealsTitle: 'Elige tus comidas',
    stepMealsDescription: 'Activa desayuno, comida o cena desde Ajustes para que los planificadores muestren solo lo que usas.',
    stepDishesTitle: 'Guarda platos frecuentes',
    stepDishesDescription: 'Añade tus recetas o platos habituales para reutilizarlos en el menú y en la lista de compra.',
    stepTuppersTitle: 'Aprovecha tuppers y sobras',
    stepTuppersDescription: 'Registra tuppers con caducidad para ver alertas visuales y añadirlos al menú antes de que caduquen.',
    primaryAction: 'Ir a ajustes',
    secondaryAction: 'Ver mis platos',
    tertiaryAction: 'Abrir tuppers',
    dismiss: 'Lo haré más tarde',
    finish: 'Entendido',
  },
  en: {
    title: 'Set up MenuDiario in 2 minutes',
    description: 'Here are three first steps so the app can recommend and organize your meals better.',
    stepMealsTitle: 'Choose your meals',
    stepMealsDescription: 'Enable breakfast, lunch or dinner from Settings so planners only show what you use.',
    stepDishesTitle: 'Save frequent dishes',
    stepDishesDescription: 'Add your recipes or regular dishes to reuse them in the menu and shopping list.',
    stepTuppersTitle: 'Use tuppers and leftovers',
    stepTuppersDescription: 'Register tuppers with expiry dates to see visual alerts and add them to the menu before they expire.',
    primaryAction: 'Go to settings',
    secondaryAction: 'View my dishes',
    tertiaryAction: 'Open tuppers',
    dismiss: 'I will do it later',
    finish: 'Got it',
  },
} as const;

export type InitialOnboardingTranslationKey = keyof typeof translations.es;

export function useInitialOnboardingTranslations(locale: Locale | 'es' | 'en') {
  const current = translations[locale as Locale] ?? translations[defaultLocale];

  return function initialOnboardingT(key: InitialOnboardingTranslationKey) {
    return current[key] ?? translations[defaultLocale][key] ?? key;
  };
}
