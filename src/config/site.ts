export const defaultLocale = 'es' as const;
export const locales = ['es', 'en'] as const;

export type Locale = (typeof locales)[number];

export const localeLabels: Record<Locale, string> = {
  es: 'Español',
  en: 'English',
};

export const siteConfig = {
  name: 'Menu Diario',
  description: 'Organiza el menú semanal en familia, guarda el histórico y comparte cambios al momento.',
  url: import.meta.env.ASTRO_SITE || 'https://jalonsomerchan.github.io',
  base: import.meta.env.ASTRO_BASE || '/',
  repositoryUrl: import.meta.env.PUBLIC_REPOSITORY_URL || 'https://github.com/jalonsomerchan/menu-diario',
  author: 'Jorge Alonso',
  defaultLocale,
  locales,
};

export type SiteConfig = typeof siteConfig;
