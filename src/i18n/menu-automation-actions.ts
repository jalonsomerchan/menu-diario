import { defaultLocale, type Locale } from '../config/site';

const translations = {
  es: {
    title: 'Acciones rápidas del menú',
    description: 'Automatiza tareas frecuentes con la semana visible.',
    copyTitle: 'Copiar semana anterior',
    copyDescription: 'Rellena la semana visible con los platos de la semana anterior.',
    copyAction: 'Copiar a esta semana',
    copied: 'Menú copiado a la semana visible.',
    sourceEmpty: 'No hay menú de la semana anterior para copiar.',
    shoppingTitle: 'Lista automática del menú',
    shoppingDescription: 'Crea una lista de compra desde las comidas planificadas de la semana visible.',
    shoppingAction: 'Crear lista automática',
    shoppingCreated: 'Lista de compra creada desde el menú.',
    shoppingEmpty: 'No hay comidas planificadas para crear la lista.',
    reviewIngredientsNote: 'Revisar ingredientes del plato',
    tupperTitle: 'Reaprovechar tupper',
    tupperDescription: 'Añade un tupper activo a una comida visible sin borrar platos.',
    tupperSelect: 'Elige un tupper',
    targetSelect: 'Elige día y comida',
    tupperAction: 'Añadir al menú',
    tupperAssigned: 'Tupper añadido al menú.',
    noTuppers: 'No hay tuppers activos disponibles.',
    noTargets: 'No hay comidas visibles disponibles.',
    breakfast: 'Desayuno',
    lunch: 'Comida',
    dinner: 'Cena',
    dishHistoryTitle: 'Historial por plato',
    dishHistoryDescription: 'Consulta cuándo se ha usado cada plato en menús recientes.',
    dishSelect: 'Elige un plato',
    dishHistoryEmpty: 'No hay usos recientes de este plato.',
    dishHistoryLoading: 'Cargando historial...',
    loading: 'Cargando acciones rápidas...',
    saved: 'Guardado.',
    error: 'No se pudo completar la acción.',
    guestSession: 'Invitado',
  },
  en: {
    title: 'Quick menu actions',
    description: 'Automate common tasks for the visible week.',
    copyTitle: 'Copy previous week',
    copyDescription: 'Fill the visible week with the meals from the previous week.',
    copyAction: 'Copy to this week',
    copied: 'Menu copied to the visible week.',
    sourceEmpty: 'There is no previous week menu to copy.',
    shoppingTitle: 'Automatic menu shopping list',
    shoppingDescription: 'Create a shopping list from the planned meals in the visible week.',
    shoppingAction: 'Create automatic list',
    shoppingCreated: 'Shopping list created from the menu.',
    shoppingEmpty: 'There are no planned meals to create the list.',
    reviewIngredientsNote: 'Review dish ingredients',
    tupperTitle: 'Reuse a tupper',
    tupperDescription: 'Add an active tupper to a visible meal without removing dishes.',
    tupperSelect: 'Choose a tupper',
    targetSelect: 'Choose day and meal',
    tupperAction: 'Add to menu',
    tupperAssigned: 'Tupper added to the menu.',
    noTuppers: 'There are no active tuppers available.',
    noTargets: 'There are no visible meals available.',
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    dishHistoryTitle: 'Dish history',
    dishHistoryDescription: 'Check when each dish has been used in recent menus.',
    dishSelect: 'Choose a dish',
    dishHistoryEmpty: 'There are no recent uses for this dish.',
    dishHistoryLoading: 'Loading history...',
    loading: 'Loading quick actions...',
    saved: 'Saved.',
    error: 'The action could not be completed.',
    guestSession: 'Guest',
  },
} as const;

export type MenuAutomationTranslationKey = keyof typeof translations.es;

export function useMenuAutomationTranslations(locale: Locale | 'es' | 'en') {
  const current = translations[locale as Locale] ?? translations[defaultLocale];

  return function menuAutomationT(key: MenuAutomationTranslationKey) {
    return current[key] ?? translations[defaultLocale][key] ?? key;
  };
}
