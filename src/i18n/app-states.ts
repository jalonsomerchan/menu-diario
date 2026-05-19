import { defaultLocale, type Locale } from '../config/site';

const translations = {
  es: {
    dashboardHintTitle: 'Empieza por lo importante',
    dashboardHintBody: 'Revisa la comida de hoy y completa los próximos días desde el planificador cuando veas huecos.',
    configuratorHintTitle: 'Planifica sin rellenarlo todo de golpe',
    configuratorHintBody: 'Toca cualquier día para editarlo. Puedes dejar comidas sin configurar y volver más tarde.',
    dishesHintTitle: 'Crea tu catálogo poco a poco',
    dishesHintBody: 'Los platos que añadas aquí aparecerán como sugerencias al planificar y al pedir ideas a la IA.',
    dishesEmptyTitle: 'Todavía no hay platos propios',
    dishesEmptyBody: 'Añade tu primer plato o duplica uno general para personalizarlo con tus etiquetas y preferencias.',
    dishesEmptyAction: 'Añadir plato',
    tuppersHintTitle: 'Guarda sobras antes de planificar la compra',
    tuppersHintBody: 'Añade tuppers con fecha de caducidad para reutilizarlos en próximas comidas y evitar desperdicio.',
    tuppersEmptyTitle: 'No hay tuppers en este filtro',
    tuppersEmptyBody: 'Crea un tupper o cambia de filtro para ver comidas preparadas disponibles.',
    tuppersEmptyAction: 'Nuevo tupper',
    planningAiHintTitle: 'La IA solo ayuda sobre los huecos que elijas',
    planningAiHintBody: 'Primero selecciona días y comidas. Después revisa cada propuesta antes de guardarla en el menú.',
    planningAiEmptyTitle: 'Aún no hay propuestas',
    planningAiEmptyBody: 'Completa el asistente y pulsa buscar ideas para ver recomendaciones aquí.',
    shoppingHintTitle: 'Revisa antes de guardar o compartir',
    shoppingHintBody: 'La IA prepara una base, pero puedes marcar ingredientes como comprar, ya lo tengo o descartar.',
    shoppingEmptyTitle: 'No hay comidas para generar compra',
    shoppingEmptyBody: 'Configura algunos platos en el planificador y vuelve para crear la lista de ingredientes.',
    shoppingEmptyAction: 'Abrir planificador',
    firebaseErrorTitle: 'La app no puede cargar datos ahora',
    firebaseErrorBody: 'Puede faltar configuración o haber un problema temporal. Prueba de nuevo más tarde.',
    permissionsErrorTitle: 'No tienes acceso a este contenido',
    permissionsErrorBody: 'Revisa que has iniciado sesión con la cuenta correcta o vuelve al inicio.',
    offlineErrorTitle: 'Sin conexión',
    offlineErrorBody: 'Puedes consultar información guardada, pero algunas acciones se desbloquearán al recuperar conexión.',
    aiErrorTitle: 'IA no disponible',
    aiErrorBody: 'Puedes seguir planificando manualmente y volver a probar la IA más tarde.',
    notificationsErrorTitle: 'Avisos no activados',
    notificationsErrorBody: 'Activa los permisos de notificaciones en el navegador si quieres recibir recordatorios.'
  },
  en: {
    dashboardHintTitle: 'Start with what matters',
    dashboardHintBody: 'Review today’s meal and complete upcoming days from the planner when you see gaps.',
    configuratorHintTitle: 'Plan without filling everything at once',
    configuratorHintBody: 'Tap any day to edit it. You can leave meals unplanned and come back later.',
    dishesHintTitle: 'Build your catalogue gradually',
    dishesHintBody: 'Dishes you add here will appear as suggestions while planning and when asking AI for ideas.',
    dishesEmptyTitle: 'No own dishes yet',
    dishesEmptyBody: 'Add your first dish or duplicate a global one to customize it with your tags and preferences.',
    dishesEmptyAction: 'Add dish',
    tuppersHintTitle: 'Save leftovers before planning shopping',
    tuppersHintBody: 'Add tuppers with expiry dates so you can reuse them in upcoming meals and avoid waste.',
    tuppersEmptyTitle: 'No tuppers in this filter',
    tuppersEmptyBody: 'Create a tupper or switch filters to see prepared meals that are available.',
    tuppersEmptyAction: 'New tupper',
    planningAiHintTitle: 'AI only helps with the slots you choose',
    planningAiHintBody: 'First select days and meals. Then review each proposal before saving it to the menu.',
    planningAiEmptyTitle: 'No proposals yet',
    planningAiEmptyBody: 'Complete the assistant and find ideas to see recommendations here.',
    shoppingHintTitle: 'Review before saving or sharing',
    shoppingHintBody: 'AI prepares a starting point, but you can mark ingredients as buy, already owned or dismiss.',
    shoppingEmptyTitle: 'No meals to generate shopping',
    shoppingEmptyBody: 'Configure some dishes in the planner and come back to create the ingredient list.',
    shoppingEmptyAction: 'Open planner',
    firebaseErrorTitle: 'The app cannot load data right now',
    firebaseErrorBody: 'Configuration may be missing or there may be a temporary problem. Please try again later.',
    permissionsErrorTitle: 'You do not have access to this content',
    permissionsErrorBody: 'Check that you signed in with the right account or go back home.',
    offlineErrorTitle: 'Offline',
    offlineErrorBody: 'You can view saved information, but some actions will unlock once the connection returns.',
    aiErrorTitle: 'AI unavailable',
    aiErrorBody: 'You can keep planning manually and try AI again later.',
    notificationsErrorTitle: 'Alerts not enabled',
    notificationsErrorBody: 'Enable notification permissions in your browser if you want reminders.'
  },
} as const;

export type AppStateTranslationKey = keyof typeof translations.es;

export function useAppStateTranslations(locale: Locale) {
  const current = translations[locale] ?? translations[defaultLocale];

  return function appStateT(key: AppStateTranslationKey) {
    return current[key] ?? translations[defaultLocale][key] ?? key;
  };
}
