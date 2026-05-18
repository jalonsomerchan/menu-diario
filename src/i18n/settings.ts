import type { Locale } from '../config/site';

const settingsCopy = {
  es: {
    profileSectionTitle: 'Perfil y preferencias',
    profileSectionDescription: 'Opciones que afectan solo a tu sesión y a cómo quieres usar Menu Diario.',
    groupSectionTitle: 'Ajustes del grupo',
    groupSectionDescription: 'Opciones compartidas para coordinar el menú, miembros e invitaciones del grupo.',
    appearanceTitle: 'Apariencia',
    appearanceDescription: 'Elige si quieres seguir el tema del navegador o fijar modo claro u oscuro.',
    mealsTitle: 'Comidas configuradas',
    mealsDescription: 'Activa las comidas que quieres ver en dashboard, planificación e histórico.',
    groupAccessTitle: 'Acceso e invitaciones',
    groupAccessDescription: 'Comparte el código, invita por email o únete a otro grupo cuando lo necesites.',
    personalDataTitle: 'Datos personales',
    personalDataDescription: 'Guarda preferencias propias que ayudan a ajustar recomendaciones y edición.',
  },
  en: {
    profileSectionTitle: 'Profile and preferences',
    profileSectionDescription: 'Options that affect only your session and how you want to use Menu Diario.',
    groupSectionTitle: 'Group settings',
    groupSectionDescription: 'Shared options to coordinate the menu, members and group invitations.',
    appearanceTitle: 'Appearance',
    appearanceDescription: 'Choose whether to follow the browser theme or force light or dark mode.',
    mealsTitle: 'Configured meals',
    mealsDescription: 'Enable the meals you want to see on the dashboard, planner and history.',
    groupAccessTitle: 'Access and invitations',
    groupAccessDescription: 'Share the code, invite by email or join another group whenever needed.',
    personalDataTitle: 'Personal data',
    personalDataDescription: 'Save your own preferences to help tune recommendations and editing.',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type SettingsCopyKey = keyof (typeof settingsCopy)['es'];

export function useSettingsTranslations(locale: Locale) {
  return function ts(key: SettingsCopyKey): string {
    return settingsCopy[locale]?.[key] ?? settingsCopy.es[key] ?? key;
  };
}
