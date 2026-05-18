import type { Locale } from '../config/site';

const publicPageCopy = {
  es: {
    aboutTitle: 'Acerca de Menu Diario',
    aboutDescription:
      'Menu Diario ayuda a familias, parejas y grupos a organizar qué comer cada día, compartir la planificación y consultar próximos menús sin complicarse.',
    aboutEyebrow: 'Organización sencilla',
    aboutIntro:
      'Menu Diario es una webapp ligera para decidir y apuntar comidas compartidas. Está pensada para usarla desde el móvil, coordinar un grupo y tener claro qué toca comer hoy, mañana y durante la semana.',
    aboutWhoTitle: 'Para quién está pensada',
    aboutWhoDescription:
      'Funciona bien para familias, parejas, pisos compartidos o cualquier grupo que necesite planificar desayunos, comidas y cenas sin depender de notas sueltas o mensajes perdidos.',
    aboutValuesTitle: 'Qué aporta',
    aboutValueSimple: 'Planificación clara por días y comidas activas.',
    aboutValueGroup: 'Edición compartida para que el grupo vea los cambios.',
    aboutValueHistory: 'Histórico y platos usados para reutilizar ideas sin repetir siempre lo mismo.',
    aboutValueMobile: 'Interfaz mobile first para editar rápido desde cualquier sitio.',
    aboutPrivacyTitle: 'Un enfoque práctico',
    aboutPrivacyDescription:
      'La app prioriza una experiencia directa: entrar, configurar el grupo, apuntar platos y revisar la semana. Las funciones conectadas a Firebase dependen de autenticación y reglas de seguridad del proyecto.',
    aboutCtaTitle: 'Empieza con tu menú',
    aboutCtaDescription:
      'Puedes entrar al dashboard, crear tu grupo y empezar a apuntar las próximas comidas en pocos pasos.',
    aboutPrimaryCta: 'Entrar al dashboard',
    aboutSecondaryCta: 'Ver repositorio',
    footerAbout: 'Acerca de',
  },
  en: {
    aboutTitle: 'About Menu Diario',
    aboutDescription:
      'Menu Diario helps families, couples and groups organize daily meals, share planning and check upcoming menus without extra friction.',
    aboutEyebrow: 'Simple planning',
    aboutIntro:
      'Menu Diario is a lightweight web app for deciding and writing down shared meals. It is designed for mobile use, group coordination and quickly knowing what is planned for today, tomorrow and the week ahead.',
    aboutWhoTitle: 'Who it is for',
    aboutWhoDescription:
      'It works well for families, couples, shared flats or any group that needs to plan breakfasts, lunches and dinners without relying on scattered notes or lost messages.',
    aboutValuesTitle: 'What it helps with',
    aboutValueSimple: 'Clear planning by day and enabled meal type.',
    aboutValueGroup: 'Shared editing so the group can see changes.',
    aboutValueHistory: 'History and used dishes to reuse ideas without always repeating the same meals.',
    aboutValueMobile: 'Mobile-first interface for quick edits anywhere.',
    aboutPrivacyTitle: 'A practical approach',
    aboutPrivacyDescription:
      'The app focuses on a direct experience: sign in, configure the group, add dishes and review the week. Firebase-powered features depend on the project authentication and security rules.',
    aboutCtaTitle: 'Start with your menu',
    aboutCtaDescription:
      'You can open the dashboard, create your group and start adding upcoming meals in just a few steps.',
    aboutPrimaryCta: 'Open dashboard',
    aboutSecondaryCta: 'View repository',
    footerAbout: 'About',
  },
} as const satisfies Record<Locale, Record<string, string>>;

export type PublicPageCopyKey = keyof (typeof publicPageCopy)['es'];

export function usePublicPageCopy(locale: Locale) {
  return function tp(key: PublicPageCopyKey): string {
    return publicPageCopy[locale]?.[key] ?? publicPageCopy.es[key] ?? key;
  };
}
