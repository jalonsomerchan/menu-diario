import type { Locale } from '../config/site';

export type PublicSeoPageKey = 'manual' | 'privacy' | 'weeklyMenu' | 'mealPlanner';

export type PublicSeoSection = {
  title: string;
  body: string;
  items?: string[];
};

export type PublicSeoPage = {
  key: PublicSeoPageKey;
  slug: string;
  navLabel: string;
  title: string;
  description: string;
  eyebrow: string;
  intro: string;
  primaryCta: string;
  secondaryCta: string;
  sections: PublicSeoSection[];
  highlights: string[];
};

const publicSeoPages = {
  es: {
    manual: {
      key: 'manual',
      slug: 'manual',
      navLabel: 'Manual de uso',
      title: 'Manual de uso de Menu Diario',
      description:
        'Manual paso a paso para usar Menu Diario, crear un grupo, planificar comidas, guardar platos y organizar el menú semanal desde el móvil.',
      eyebrow: 'Manual práctico',
      intro:
        'Aprende a usar Menu Diario desde el primer acceso: entra con tu cuenta, crea o únete a un grupo, configura las comidas activas y empieza a planificar desayunos, comidas y cenas sin depender de hojas de cálculo ni mensajes sueltos.',
      primaryCta: 'Entrar al dashboard',
      secondaryCta: 'Ver cómo funciona',
      highlights: [
        'Primeros pasos para crear o unirse a un grupo.',
        'Planificación diaria de desayuno, comida y cena.',
        'Uso de platos guardados, histórico y recomendaciones con IA.',
      ],
      sections: [
        {
          title: 'Primer acceso y grupo',
          body: 'Al entrar puedes identificarte, crear un grupo propio o aceptar una invitación. El grupo sirve para compartir el menú con familia, pareja, piso o cualquier equipo que decida comidas en común.',
          items: ['Usa un nombre claro para el grupo.', 'Revisa quién puede editar antes de compartir la planificación.', 'Mantén un único grupo por hogar si todos comen el mismo menú.'],
        },
        {
          title: 'Configurar comidas activas',
          body: 'La configuración permite decidir qué comidas se planifican cada día. Puedes trabajar solo con comidas y cenas, activar desayunos o dejar notas cuando un día se come fuera.',
          items: ['Activa únicamente las franjas que de verdad uses.', 'Marca comidas como fuera cuando no haga falta cocinar.', 'Añade notas breves para compras, sobras o cambios de última hora.'],
        },
        {
          title: 'Planificar la semana',
          body: 'Desde el dashboard puedes ver los próximos días y editar cada bloque. La idea es rellenar primero lo seguro y después completar huecos con platos guardados o propuestas nuevas.',
          items: ['Empieza por los días con menos margen.', 'Reutiliza platos que ya funcionaron.', 'Deja huecos visibles para decidirlos más tarde.'],
        },
        {
          title: 'Revisar histórico y platos',
          body: 'El histórico ayuda a recuperar ideas anteriores y el catálogo de platos evita repetir siempre lo mismo. Cuanto más lo uses, más fácil será organizar menús equilibrados y variados.',
          items: ['Guarda platos frecuentes.', 'Consulta semanas anteriores antes de comprar.', 'Usa el histórico para detectar repeticiones.'],
        },
      ],
    },
    privacy: {
      key: 'privacy',
      slug: 'politica-privacidad',
      navLabel: 'Privacidad',
      title: 'Política de privacidad de Menu Diario',
      description:
        'Información sobre privacidad, datos de usuario, grupos, menús, autenticación y uso responsable de Menu Diario como webapp de planificación de comidas.',
      eyebrow: 'Privacidad y datos',
      intro:
        'Esta página resume de forma clara qué datos puede necesitar Menu Diario para funcionar, por qué se usan y cómo se protegen dentro de la experiencia de planificación compartida.',
      primaryCta: 'Entrar al dashboard',
      secondaryCta: 'Leer preguntas frecuentes',
      highlights: [
        'La app usa autenticación para identificar a cada persona.',
        'Los menús y platos se vinculan al usuario o grupo correspondiente.',
        'No se deben introducir datos sensibles en notas o nombres de platos.',
      ],
      sections: [
        {
          title: 'Datos necesarios para usar la app',
          body: 'Para ofrecer grupos, menús compartidos, platos guardados e histórico, la app puede guardar identificadores de usuario, pertenencia a grupos, configuración del menú, platos, notas y cambios realizados dentro de la planificación.',
        },
        {
          title: 'Uso de la información',
          body: 'La información se usa para mostrar el menú correcto, sincronizar cambios entre miembros del grupo, recuperar platos usados y mantener una experiencia coherente entre dispositivos.',
          items: ['Mostrar la planificación semanal.', 'Permitir edición compartida del grupo.', 'Guardar preferencias de uso y platos frecuentes.'],
        },
        {
          title: 'Autenticación y servicios técnicos',
          body: 'Las funciones conectadas dependen de Firebase y de sus reglas de seguridad. El acceso a la información debe limitarse a usuarios autenticados y miembros del grupo correspondiente.',
        },
        {
          title: 'Buenas prácticas de privacidad',
          body: 'Menu Diario está pensado para organizar comidas, no para guardar información sensible. Evita escribir datos personales delicados en notas, nombres de grupo o campos libres.',
          items: ['Usa nombres de grupo genéricos.', 'No incluyas datos médicos detallados en notas.', 'Revisa los miembros del grupo antes de compartir invitaciones.'],
        },
      ],
    },
    weeklyMenu: {
      key: 'weeklyMenu',
      slug: 'organizar-menu-semanal',
      navLabel: 'Menú semanal',
      title: 'Cómo organizar un menú semanal en familia',
      description:
        'Guía SEO para organizar un menú semanal familiar con Menu Diario, planificar comidas, ahorrar tiempo y coordinar cambios entre varias personas.',
      eyebrow: 'Guía de planificación',
      intro:
        'Organizar un menú semanal reduce compras improvisadas, evita repetir platos y ayuda a que todos sepan qué toca comer. Menu Diario centraliza esa planificación en una webapp rápida y pensada para grupos.',
      primaryCta: 'Planificar mi menú',
      secondaryCta: 'Ver manual',
      highlights: [
        'Planificación visual por días para familias y grupos.',
        'Menos dudas antes de comprar o cocinar.',
        'Más variedad gracias a platos guardados e histórico.'],
      sections: [
        {
          title: 'Empieza por las comidas fijas',
          body: 'Anota primero los días con menos flexibilidad: comidas de trabajo, cenas familiares, tuppers, entrenamientos o días en los que se come fuera. Así el menú semanal se construye sobre decisiones reales.',
        },
        {
          title: 'Combina platos rápidos y recetas más completas',
          body: 'Un menú práctico mezcla opciones sencillas para días con poco tiempo y platos más elaborados cuando se puede cocinar con calma o dejar algo preparado.',
          items: ['Reserva recetas rápidas para días cargados.', 'Aprovecha sobras para cenas o tuppers.', 'Alterna carne, pescado, legumbres, verduras y platos fríos.'],
        },
        {
          title: 'Coordina el grupo antes de comprar',
          body: 'Cuando todos ven el menú, es más fácil ajustar preferencias, intolerancias, horarios y cambios de última hora antes de hacer la compra semanal.',
        },
        {
          title: 'Repite lo que funciona sin caer en la rutina',
          body: 'El histórico ayuda a recuperar platos que gustaron, pero también a detectar repeticiones. La clave es tener una base de platos favoritos y rotarlos con ideas nuevas.',
        },
      ],
    },
    mealPlanner: {
      key: 'mealPlanner',
      slug: 'planificador-comidas',
      navLabel: 'Planificador de comidas',
      title: 'Planificador de comidas online para familias',
      description:
        'Descubre cómo usar Menu Diario como planificador de comidas online para familias, parejas y grupos que quieren decidir qué comer sin caos.',
      eyebrow: 'Webapp de planificación',
      intro:
        'Menu Diario funciona como un planificador de comidas online: reúne calendario, platos, notas, histórico y coordinación de grupo en una experiencia sencilla para el día a día.',
      primaryCta: 'Abrir planificador',
      secondaryCta: 'Cómo funciona',
      highlights: [
        'Dashboard claro para saber qué toca comer.',
        'Edición compartida para familias, parejas y pisos.',
        'Ideas de platos para completar huecos del menú.'],
      sections: [
        {
          title: 'Qué resuelve un planificador de comidas',
          body: 'Un planificador evita decidir cada comida a última hora. Permite anticipar compras, repartir tareas y mantener una visión compartida de desayunos, comidas y cenas.',
        },
        {
          title: 'Diferencia frente a una nota o una hoja de cálculo',
          body: 'A diferencia de una lista suelta, Menu Diario está pensado para editar por día, consultar desde el móvil, guardar platos y mantener contexto histórico.',
          items: ['Menos mensajes repetidos.', 'Menos platos olvidados.', 'Más claridad para todos los miembros del grupo.'],
        },
        {
          title: 'Uso con inteligencia artificial',
          body: 'Las recomendaciones con IA pueden ayudar a completar huecos, proponer platos equilibrados y adaptar ideas a preferencias, intolerancias o tiempo disponible.',
        },
        {
          title: 'Cuándo merece la pena usarlo',
          body: 'Es especialmente útil cuando varias personas comen juntas, cuando hay compras semanales, cuando se preparan tuppers o cuando se quiere comer más variado sin dedicar demasiado tiempo a decidir.',
        },
      ],
    },
  },
  en: {
    manual: {
      key: 'manual',
      slug: 'manual',
      navLabel: 'User guide',
      title: 'Menu Diario user guide',
      description:
        'Step-by-step guide to using Menu Diario, creating a group, planning meals, saving dishes and organizing a weekly menu from your phone.',
      eyebrow: 'Practical guide',
      intro:
        'Learn how to use Menu Diario from the first visit: sign in, create or join a group, configure active meals and start planning breakfasts, lunches and dinners without spreadsheets or scattered messages.',
      primaryCta: 'Open dashboard',
      secondaryCta: 'See how it works',
      highlights: ['First steps to create or join a group.', 'Daily planning for breakfast, lunch and dinner.', 'Saved dishes, history and AI recommendations.'],
      sections: [
        {
          title: 'First access and group setup',
          body: 'After signing in, you can create your own group or accept an invitation. Groups help families, couples, flatmates or any shared household coordinate one common menu.',
          items: ['Use a clear group name.', 'Review who can edit before sharing planning.', 'Keep one group per household when everyone follows the same menu.'],
        },
        {
          title: 'Configure active meals',
          body: 'Setup lets you decide which meals are planned each day. You can work only with lunches and dinners, enable breakfasts or add notes when somebody eats out.',
          items: ['Enable only the meal slots you actually use.', 'Mark meals as away when cooking is not needed.', 'Add short notes for shopping, leftovers or last-minute changes.'],
        },
        {
          title: 'Plan the week',
          body: 'From the dashboard you can view upcoming days and edit each block. Fill in what is certain first, then complete gaps with saved dishes or fresh suggestions.',
          items: ['Start with the busiest days.', 'Reuse dishes that worked well.', 'Leave visible gaps to decide later.'],
        },
        {
          title: 'Review history and dishes',
          body: 'History helps recover previous ideas, while the dish catalog reduces repetition. The more you use it, the easier it becomes to plan varied meals.',
          items: ['Save frequent dishes.', 'Check previous weeks before shopping.', 'Use history to spot repeated meals.'],
        },
      ],
    },
    privacy: {
      key: 'privacy',
      slug: 'politica-privacidad',
      navLabel: 'Privacy',
      title: 'Menu Diario privacy policy',
      description:
        'Information about privacy, user data, groups, menus, authentication and responsible use of Menu Diario as a meal planning web app.',
      eyebrow: 'Privacy and data',
      intro:
        'This page explains in plain language which data Menu Diario may need to work, why it is used and how it supports shared meal planning.',
      primaryCta: 'Open dashboard',
      secondaryCta: 'Read FAQ',
      highlights: ['The app uses authentication to identify each person.', 'Menus and dishes are linked to the correct user or group.', 'Sensitive details should not be added to notes or dish names.'],
      sections: [
        {
          title: 'Data needed to use the app',
          body: 'To provide groups, shared menus, saved dishes and history, the app may store user identifiers, group membership, menu setup, dishes, notes and planning changes.',
        },
        {
          title: 'How information is used',
          body: 'Information is used to show the right menu, sync changes between group members, recover used dishes and keep a consistent experience across devices.',
          items: ['Display weekly planning.', 'Enable shared group editing.', 'Save preferences and frequent dishes.'],
        },
        {
          title: 'Authentication and technical services',
          body: 'Connected features rely on Firebase and security rules. Access should be limited to authenticated users and members of the related group.',
        },
        {
          title: 'Privacy best practices',
          body: 'Menu Diario is meant for meal organization, not for storing sensitive information. Avoid adding delicate personal data to notes, group names or free-text fields.',
          items: ['Use generic group names.', 'Do not include detailed medical data in notes.', 'Review group members before sharing invitations.'],
        },
      ],
    },
    weeklyMenu: {
      key: 'weeklyMenu',
      slug: 'organizar-menu-semanal',
      navLabel: 'Weekly menu',
      title: 'How to organize a weekly family menu',
      description:
        'SEO guide to organizing a weekly family menu with Menu Diario, planning meals, saving time and coordinating changes across several people.',
      eyebrow: 'Planning guide',
      intro:
        'A weekly menu reduces improvised shopping, avoids repeating dishes and helps everyone know what is planned. Menu Diario centralizes that planning in a fast group-friendly web app.',
      primaryCta: 'Plan my menu',
      secondaryCta: 'Read guide',
      highlights: ['Visual planning by day for families and groups.', 'Fewer doubts before shopping or cooking.', 'More variety through saved dishes and history.'],
      sections: [
        {
          title: 'Start with fixed meals',
          body: 'Write down the least flexible days first: work lunches, family dinners, lunchboxes, training days or meals away from home. The weekly menu should be based on real constraints.',
        },
        {
          title: 'Mix quick dishes and fuller recipes',
          body: 'A practical menu combines simple options for busy days with more complete meals when there is time to cook or prepare ahead.',
          items: ['Use quick recipes on loaded days.', 'Turn leftovers into dinners or lunchboxes.', 'Alternate meat, fish, legumes, vegetables and cold dishes.'],
        },
        {
          title: 'Coordinate the group before shopping',
          body: 'When everyone can see the menu, it is easier to adjust preferences, intolerances, schedules and last-minute changes before the weekly shop.',
        },
        {
          title: 'Repeat what works without getting stuck',
          body: 'History helps bring back dishes people liked, but also makes repetition visible. Keep a base of favorites and rotate them with new ideas.',
        },
      ],
    },
    mealPlanner: {
      key: 'mealPlanner',
      slug: 'planificador-comidas',
      navLabel: 'Meal planner',
      title: 'Online meal planner for families',
      description:
        'Discover how to use Menu Diario as an online meal planner for families, couples and groups that want to decide what to eat without chaos.',
      eyebrow: 'Planning web app',
      intro:
        'Menu Diario works as an online meal planner: it combines calendar, dishes, notes, history and group coordination in a simple everyday experience.',
      primaryCta: 'Open planner',
      secondaryCta: 'How it works',
      highlights: ['Clear dashboard to know what is planned.', 'Shared editing for families, couples and flats.', 'Dish ideas to fill menu gaps.'],
      sections: [
        {
          title: 'What a meal planner solves',
          body: 'A meal planner avoids deciding every meal at the last minute. It helps anticipate shopping, split responsibilities and keep a shared view of breakfasts, lunches and dinners.',
        },
        {
          title: 'Better than a note or spreadsheet',
          body: 'Unlike a loose list, Menu Diario is designed for day-by-day editing, mobile use, saved dishes and historical context.',
          items: ['Fewer repeated messages.', 'Fewer forgotten dishes.', 'More clarity for every group member.'],
        },
        {
          title: 'Using artificial intelligence',
          body: 'AI recommendations can help fill gaps, suggest balanced dishes and adapt ideas to preferences, intolerances or available time.',
        },
        {
          title: 'When it is worth using',
          body: 'It is especially useful when several people eat together, when there is a weekly shop, when lunchboxes are prepared or when you want more variety without spending too much time deciding.',
        },
      ],
    },
  },
} as const satisfies Record<Locale, Record<PublicSeoPageKey, PublicSeoPage>>;

export const publicSeoPageKeys = ['manual', 'weeklyMenu', 'mealPlanner', 'privacy'] as const satisfies PublicSeoPageKey[];

export function getPublicSeoPage(locale: Locale, key: PublicSeoPageKey): PublicSeoPage {
  return publicSeoPages[locale]?.[key] ?? publicSeoPages.es[key];
}

export function getPublicSeoPages(locale: Locale): PublicSeoPage[] {
  return publicSeoPageKeys.map((key) => getPublicSeoPage(locale, key));
}

export function getPublicSeoRelatedPages(locale: Locale, currentKey: PublicSeoPageKey): PublicSeoPage[] {
  return getPublicSeoPages(locale).filter((page) => page.key !== currentKey).slice(0, 3);
}
