import { defaultLocale, type Locale } from '../config/site';

const translations = {
  es: {
    eyebrow: 'Menú completo',
    title: 'Más opciones',
    description: 'Encuentra todas las secciones de Menu Diario en un solo sitio, ordenadas por lo que necesitas hacer.',
    open: 'Abrir',
    groupMain: 'Uso diario',
    groupMainDescription: 'Accesos principales para consultar, planificar y comprar.',
    groupAi: 'Herramientas con IA',
    groupAiDescription: 'Genera ideas, menús y listas cuando quieras ahorrar tiempo.',
    groupManage: 'Organización',
    groupManageDescription: 'Gestiona platos, tuppers y el histórico de comidas.',
    groupInsights: 'Resumen y análisis',
    groupInsightsDescription: 'Revisa la variedad del menú y lo que se ha planificado.',
    groupAccount: 'Cuenta y ajustes',
    groupAccountDescription: 'Configura el grupo, preferencias y opciones de la app.',
    dashboardDescription: 'Vista rápida de hoy, próximos días y accesos principales.',
    plannerDescription: 'Edita la semana, mueve comidas y deja la planificación lista.',
    shoppingDescription: 'Consulta y gestiona tus listas de la compra guardadas.',
    planningAiDescription: 'Completa menús con ayuda de IA según tus preferencias.',
    recommenderDescription: 'Recibe ideas de platos para una comida concreta.',
    shoppingAiTitle: 'Compras con IA',
    shoppingAiDescription: 'Genera una lista de compra guiada a partir de tus necesidades.',
    dishesDescription: 'Guarda platos favoritos, bloqueados, etiquetas y estadísticas.',
    tuppersDescription: 'Controla tuppers, caducidad y reutilización en el menú.',
    summaryDescription: 'Comprueba repeticiones, huecos y equilibrio semanal.',
    statsDescription: 'Consulta métricas de uso, variedad y hábitos del menú.',
    historyDescription: 'Busca comidas pasadas y revisa lo planificado anteriormente.',
    settingsDescription: 'Gestiona grupo, sesión, idioma, tema y preferencias.',
  },
  en: {
    eyebrow: 'Full menu',
    title: 'More options',
    description: 'Find every Menu Diario section in one place, ordered by what you need to do.',
    open: 'Open',
    groupMain: 'Daily use',
    groupMainDescription: 'Main shortcuts to check, plan and shop.',
    groupAi: 'AI tools',
    groupAiDescription: 'Generate ideas, menus and lists when you want to save time.',
    groupManage: 'Organization',
    groupManageDescription: 'Manage dishes, tuppers and your meal history.',
    groupInsights: 'Summary and insights',
    groupInsightsDescription: 'Review menu variety and what has been planned.',
    groupAccount: 'Account and settings',
    groupAccountDescription: 'Configure the group, preferences and app options.',
    dashboardDescription: 'Quick view of today, upcoming days and main shortcuts.',
    plannerDescription: 'Edit the week, move meals and get the plan ready.',
    shoppingDescription: 'Check and manage your saved shopping lists.',
    planningAiDescription: 'Complete menus with AI based on your preferences.',
    recommenderDescription: 'Get dish ideas for a specific meal.',
    shoppingAiTitle: 'AI shopping',
    shoppingAiDescription: 'Generate a guided shopping list from your needs.',
    dishesDescription: 'Save favorite and blocked dishes, tags and statistics.',
    tuppersDescription: 'Track tuppers, expiry dates and reuse them in the menu.',
    summaryDescription: 'Check repetitions, gaps and weekly balance.',
    statsDescription: 'Review usage, variety and menu habit metrics.',
    historyDescription: 'Search past meals and review previous planning.',
    settingsDescription: 'Manage group, session, language, theme and preferences.',
  },
} as const;

export type MorePageTranslationKey = keyof typeof translations.es;

export function useMorePageTranslations(locale: Locale) {
  const current = translations[locale] ?? translations[defaultLocale];

  return function morePageT(key: MorePageTranslationKey) {
    return current[key] ?? translations[defaultLocale][key] ?? key;
  };
}
