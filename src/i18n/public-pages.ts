import type { Locale } from '../config/site';

export type PublicFaqItem = {
  question: string;
  answer: string;
};

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
    faqTitle: 'Preguntas frecuentes',
    faqDescription:
      'Respuestas rápidas sobre cómo funciona Menu Diario, cómo se comparten los menús y qué puede hacer cada persona del grupo.',
    faqEyebrow: 'Dudas habituales',
    faqIntro:
      'Estas respuestas resumen el funcionamiento actual de la app para que puedas empezar sin perder tiempo configurando cosas innecesarias.',
    faqCtaTitle: '¿Preparado para organizar la semana?',
    faqCtaDescription: 'Entra al dashboard, crea o únete a tu grupo y empieza a apuntar comidas desde el móvil.',
    faqPrimaryCta: 'Ir al dashboard',
    footerAbout: 'Acerca de',
    footerFaq: 'FAQ',
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
    faqTitle: 'Frequently asked questions',
    faqDescription:
      'Quick answers about how Menu Diario works, how menus are shared and what each group member can do.',
    faqEyebrow: 'Common questions',
    faqIntro:
      'These answers summarize the current app behavior so you can start without spending time on unnecessary setup.',
    faqCtaTitle: 'Ready to organize the week?',
    faqCtaDescription: 'Open the dashboard, create or join your group and start adding meals from your phone.',
    faqPrimaryCta: 'Open dashboard',
    footerAbout: 'About',
    footerFaq: 'FAQ',
  },
} as const satisfies Record<Locale, Record<string, string>>;

const publicFaqItems = {
  es: [
    {
      question: '¿Qué es Menu Diario?',
      answer:
        'Es una webapp para planificar comidas por días, compartir el menú con otras personas y consultar rápidamente qué toca comer esta semana.',
    },
    {
      question: '¿Tengo que crear un grupo?',
      answer:
        'Puedes usar la app de forma individual, pero los grupos sirven para coordinar familias, parejas o pisos compartidos con un menú común.',
    },
    {
      question: '¿Quién puede editar el menú?',
      answer:
        'Los miembros del grupo pueden editar la planificación compartida. Los cambios se guardan en Firebase y se reflejan para el resto del grupo.',
    },
    {
      question: '¿Cómo se planifican las comidas?',
      answer:
        'Desde el dashboard o la configuración puedes editar cada día, añadir platos, marcar comidas como fuera o dejar notas útiles para el grupo.',
    },
    {
      question: '¿Qué guarda el histórico?',
      answer:
        'El histórico permite revisar menús anteriores y recuperar ideas. La app normaliza los días para conservar comidas, notas y platos usados.',
    },
    {
      question: '¿Para qué sirven “Mis platos”?',
      answer:
        'El catálogo ayuda a reutilizar platos, detectar los más usados y partir de platos generales sin modificar el catálogo administrado.',
    },
    {
      question: '¿Funciona bien en móvil?',
      answer:
        'Sí. La interfaz está pensada mobile first, con tarjetas, acciones rápidas y navegación preparada para usarla desde el teléfono.',
    },
    {
      question: '¿Qué pasa con mis datos?',
      answer:
        'Los datos de la app se guardan en Firebase y el acceso depende de autenticación, pertenencia al grupo y reglas de seguridad del proyecto.',
    },
    {
      question: '¿Hay notificaciones?',
      answer:
        'La app incluye avisos del navegador para cambios cuando están permitidos. No envía push si el navegador no tiene la app abierta o cargada.',
    },
  ],
  en: [
    {
      question: 'What is Menu Diario?',
      answer:
        'It is a web app for planning meals by day, sharing the menu with other people and quickly checking what is planned for the week.',
    },
    {
      question: 'Do I need to create a group?',
      answer:
        'You can use the app individually, but groups help families, couples or shared flats coordinate around one shared menu.',
    },
    {
      question: 'Who can edit the menu?',
      answer:
        'Group members can edit the shared plan. Changes are stored in Firebase and reflected for the rest of the group.',
    },
    {
      question: 'How are meals planned?',
      answer:
        'From the dashboard or setup screen you can edit each day, add dishes, mark meals as skipped or away, and leave useful notes for the group.',
    },
    {
      question: 'What does the history keep?',
      answer:
        'History lets you review previous menus and recover ideas. The app normalizes days to preserve meals, notes and used dishes.',
    },
    {
      question: 'What is “My dishes” for?',
      answer:
        'The catalog helps reuse dishes, spot frequent meals and start from global dishes without modifying the managed catalog.',
    },
    {
      question: 'Does it work well on mobile?',
      answer:
        'Yes. The interface is mobile first, with cards, quick actions and navigation designed for phone use.',
    },
    {
      question: 'What happens to my data?',
      answer:
        'App data is stored in Firebase, and access depends on authentication, group membership and the project security rules.',
    },
    {
      question: 'Are there notifications?',
      answer:
        'The app includes browser notifications for changes when permissions are granted. It does not send push notifications if the browser is not open or loaded.',
    },
  ],
} as const satisfies Record<Locale, PublicFaqItem[]>;

export type PublicPageCopyKey = keyof (typeof publicPageCopy)['es'];

export function usePublicPageCopy(locale: Locale) {
  return function tp(key: PublicPageCopyKey): string {
    return publicPageCopy[locale]?.[key] ?? publicPageCopy.es[key] ?? key;
  };
}

export function getPublicFaqItems(locale: Locale): PublicFaqItem[] {
  return publicFaqItems[locale] ?? publicFaqItems.es;
}
