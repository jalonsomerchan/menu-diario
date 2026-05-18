import { type Locale } from '../config/site';

type FooterLabels = {
  eyebrow: string;
  title: string;
  copy: string;
  tools: string;
  games: string;
  openProject: string;
};

export type FooterProject = {
  name: string;
  href: string;
};

const footerLabels: Record<Locale, FooterLabels> = {
  es: {
    eyebrow: 'Otros proyectos',
    title: 'Más herramientas y juegos de AlonSoftware',
    copy: 'Explora utilidades rápidas y juegos ligeros creados para usarse desde cualquier dispositivo.',
    tools: 'Herramientas',
    games: 'Juegos',
    openProject: 'Abrir {project}',
  },
  en: {
    eyebrow: 'Other projects',
    title: 'More tools and games by AlonSoftware',
    copy: 'Explore fast utilities and lightweight games made to work on any device.',
    tools: 'Tools',
    games: 'Games',
    openProject: 'Open {project}',
  },
};

export const footerTools: FooterProject[] = [
  { name: 'FácilPDF', href: 'https://facilpdf.alon.one' },
  { name: 'FacilIMG', href: 'https://facilimg.alon.one' },
  { name: 'Print a Calendar', href: 'https://printacalendar.alon.one' },
];

export const footerGames: FooterProject[] = [
  { name: 'HitYear', href: 'https://hityear.alon.one' },
  { name: 'Democrazy', href: 'https://democrazy.alon.one' },
  { name: 'Hamster Run', href: 'https://hamsterrun.alon.one' },
  { name: 'Mundial de fútbol 2026', href: 'https://mundial2026.alon.one' },
];

export function getFooterLabels(locale: Locale) {
  return footerLabels[locale] ?? footerLabels.es;
}

export function formatProjectLabel(template: string, project: string) {
  return template.replaceAll('{project}', project);
}
