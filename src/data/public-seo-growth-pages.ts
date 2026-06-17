export const publicSeoGrowthPageKeys = [
  'shoppingList',
  'aiMealPlanner',
  'tupperPlanning',
  'batchCooking',
  'familyMealApp',
  'healthyWeeklyMenu',
] as const;

export const publicSeoGrowthPages = {
  es: {
    shoppingList: {
      key: 'shoppingList',
      slug: 'lista-compra-semanal',
      navLabel: 'Lista de compra semanal',
      title: 'Lista de compra semanal automática para organizar tus comidas',
      description:
        'Crea una lista de compra semanal a partir del menú planificado, evita duplicados y compra solo lo necesario para desayunos, comidas y cenas.',
      eyebrow: 'Compra organizada',
      intro:
        'Una buena lista de compra semanal empieza antes de ir al supermercado: primero decides qué se va a comer, después agrupas ingredientes y finalmente marcas lo que ya tienes en casa. Menu Diario conecta menú, platos y compra para reducir olvidos y compras improvisadas.',
      primaryCta: 'Crear mi lista de compra',
      secondaryCta: 'Ver manual',
      relatedTitle: 'Guías para comprar mejor',
      relatedEyebrow: 'Planificación y compra',
      highlights: [
        'Lista de compra ligada al menú semanal real.',
        'Menos productos repetidos y menos improvisación.',
        'Útil para familias, parejas, pisos compartidos y batch cooking.',
      ],
      sections: [
        {
          title: 'Por qué hacer la lista desde el menú',
          body: 'Cuando la compra nace del menú semanal, cada producto tiene un motivo. Es más fácil evitar duplicados, no olvidar básicos y ajustar cantidades según las comidas que realmente vas a preparar.',
          items: ['Planifica primero los platos principales.', 'Agrupa ingredientes repetidos.', 'Revisa despensa y tuppers antes de comprar.'],
        },
        {
          title: 'Qué problemas evita',
          body: 'Evita llegar al supermercado sin saber qué falta, comprar ingredientes que no encajan con ninguna comida o descubrir a mitad de semana que falta algo para una receta importante.',
        },
        {
          title: 'Compra compartida entre varias personas',
          body: 'Si varias personas cocinan o hacen la compra, una lista centralizada evita mensajes sueltos y permite que todos sepan qué queda pendiente.',
          items: ['Ideal para familias.', 'Práctico para parejas con horarios distintos.', 'Útil en pisos compartidos con comidas comunes.'],
        },
        {
          title: 'Del menú semanal al carrito',
          body: 'Menu Diario está pensado para que el menú, los platos guardados, los tuppers y la compra formen parte del mismo flujo. La lista no es una nota aislada, sino una consecuencia de lo planificado.',
        },
      ],
    },
    aiMealPlanner: {
      key: 'aiMealPlanner',
      slug: 'planificador-menu-ia',
      navLabel: 'Planificador con IA',
      title: 'Planificador de menú semanal con inteligencia artificial',
      description:
        'Usa IA para completar huecos del menú semanal, proponer comidas variadas y adaptar ideas a preferencias, intolerancias y tiempo disponible.',
      eyebrow: 'IA para comer mejor',
      intro:
        'La inteligencia artificial puede ayudar cuando no sabes qué cocinar, pero funciona mejor si parte de tu contexto: días disponibles, tipo de comida, platos recientes, preferencias del grupo y tiempo para preparar cada receta.',
      primaryCta: 'Probar planificador IA',
      secondaryCta: 'Ver manual',
      relatedTitle: 'Más planificación inteligente',
      relatedEyebrow: 'IA y menús',
      highlights: [
        'Ideas para completar días sin planificar.',
        'Recomendaciones con contexto de grupo y comidas recientes.',
        'Menos bloqueo al decidir comidas y cenas.',
      ],
      sections: [
        {
          title: 'IA útil, no menú aleatorio',
          body: 'Un planificador con IA no debería generar platos al azar. Debe respetar tus comidas activas, evitar repetir demasiado y proponer opciones que encajen con el día a día real.',
        },
        {
          title: 'Completar huecos del menú',
          body: 'La IA es especialmente útil cuando ya tienes parte de la semana organizada y solo quedan comidas sin decidir. Así no sustituye tus decisiones, las completa.',
          items: ['Rellena comidas pendientes.', 'Propone alternativas rápidas.', 'Ayuda a equilibrar variedad y rutina.'],
        },
        {
          title: 'Preferencias e intolerancias',
          body: 'El contexto del grupo permite pedir ideas más ajustadas: platos sin ciertos ingredientes, comidas ligeras, opciones para preparar el día anterior o recetas para varias personas.',
        },
        {
          title: 'Revisar antes de guardar',
          body: 'Las propuestas de IA deben ser un punto de partida. Con Menu Diario puedes revisar, adaptar y guardar solo lo que encaja con tu semana.',
        },
      ],
    },
    tupperPlanning: {
      key: 'tupperPlanning',
      slug: 'organizar-tuppers-comidas',
      navLabel: 'Organizar tuppers',
      title: 'Cómo organizar tuppers y aprovechar sobras en el menú semanal',
      description:
        'Guía para planificar tuppers, controlar caducidad, reaprovechar sobras y colocarlas dentro del menú semanal sin olvidar comida en la nevera.',
      eyebrow: 'Sobras bajo control',
      intro:
        'Los tuppers son una forma sencilla de ahorrar tiempo y dinero, pero solo funcionan si se sabe qué hay, cuándo caduca y en qué comida se va a usar. Menu Diario ayuda a convertir las sobras en parte visible del menú.',
      primaryCta: 'Organizar mis tuppers',
      secondaryCta: 'Ver manual',
      relatedTitle: 'Planificar aprovechando comida',
      relatedEyebrow: 'Tuppers y menú',
      highlights: [
        'Control visual de tuppers disponibles.',
        'Menos comida olvidada en la nevera.',
        'Reaprovecha sobras como comidas planificadas.',
      ],
      sections: [
        {
          title: 'El problema de los tuppers invisibles',
          body: 'Un tupper sin fecha ni destino acaba olvidado. La clave es registrarlo, indicar raciones y asignarlo a una comida concreta antes de que pierda prioridad.',
        },
        {
          title: 'Planificar sobras desde el principio',
          body: 'Hay recetas que merece la pena cocinar en más cantidad: legumbres, guisos, cremas, arroces o platos que aguantan bien. Si las sobras entran en el menú, dejan de ser un imprevisto.',
          items: ['Cocina raciones extra cuando compense.', 'Asigna tuppers a días con poco tiempo.', 'Marca caducidad para priorizar consumo.'],
        },
        {
          title: 'Comidas de trabajo y días rápidos',
          body: 'Los tuppers son especialmente útiles para comidas fuera de casa, cenas rápidas y días en los que no apetece cocinar desde cero.',
        },
        {
          title: 'Comprar menos y aprovechar mejor',
          body: 'Cuando sabes qué tuppers tienes, la lista de compra puede ajustarse mejor y no compras ingredientes para comidas que ya están resueltas.',
        },
      ],
    },
    batchCooking: {
      key: 'batchCooking',
      slug: 'batch-cooking-semanal',
      navLabel: 'Batch cooking semanal',
      title: 'Batch cooking semanal: planifica comidas para cocinar menos entre semana',
      description:
        'Organiza una sesión de batch cooking semanal con menú, tuppers, lista de compra y platos que puedas reutilizar durante varios días.',
      eyebrow: 'Cocinar una vez, resolver varios días',
      intro:
        'El batch cooking funciona cuando no se limita a cocinar mucho un día: necesita un plan semanal, platos combinables, raciones claras y una lista de compra coherente. Menu Diario ayuda a preparar esa estructura antes de encender los fogones.',
      primaryCta: 'Planificar batch cooking',
      secondaryCta: 'Ver manual',
      relatedTitle: 'Organización semanal',
      relatedEyebrow: 'Cocina y planificación',
      highlights: [
        'Menú pensado para cocinar menos entre semana.',
        'Raciones y tuppers visibles desde la planificación.',
        'Compra alineada con lo que vas a preparar.',
      ],
      sections: [
        {
          title: 'Elegir recetas que se reutilizan bien',
          body: 'No todos los platos sirven para batch cooking. Conviene priorizar bases versátiles, guisos, verduras asadas, cereales, legumbres y proteínas que puedan combinarse de varias formas.',
        },
        {
          title: 'Planificar por bloques',
          body: 'Una sesión eficiente separa preparaciones base, platos completos y complementos. Así puedes resolver comidas distintas sin comer exactamente lo mismo cada día.',
          items: ['Bases: arroz, pasta, patata o quinoa.', 'Proteínas: pollo, legumbres, pescado o tofu.', 'Complementos: verduras, salsas y ensaladas.'],
        },
        {
          title: 'Asignar lo cocinado al calendario',
          body: 'La planificación evita que los tuppers queden sin destino. Cada ración debe tener un día aproximado o una prioridad de consumo.',
        },
        {
          title: 'Reducir decisiones durante la semana',
          body: 'El objetivo no es cocinar perfecto, sino llegar al lunes con parte del trabajo hecho y menos decisiones pendientes.',
        },
      ],
    },
    familyMealApp: {
      key: 'familyMealApp',
      slug: 'app-menu-semanal-familiar',
      navLabel: 'App menú familiar',
      title: 'App para organizar el menú semanal familiar desde el móvil',
      description:
        'Menu Diario es una webapp para organizar el menú semanal familiar, coordinar comidas, guardar platos y compartir cambios desde el móvil.',
      eyebrow: 'Menú familiar compartido',
      intro:
        'Cuando varias personas comen juntas, decidir el menú por mensajes o notas sueltas acaba generando dudas. Una app de menú semanal familiar centraliza comidas, cenas, platos frecuentes, tuppers y cambios de última hora.',
      primaryCta: 'Crear menú familiar',
      secondaryCta: 'Cómo funciona',
      relatedTitle: 'Más formas de organizarse',
      relatedEyebrow: 'Familia y grupos',
      highlights: [
        'Vista común del menú para toda la familia.',
        'Edición compartida sin cadenas infinitas de mensajes.',
        'Histórico de platos para repetir lo que funciona.',
      ],
      sections: [
        {
          title: 'Un único sitio para decidir qué comer',
          body: 'La principal ventaja es que todos consultan el mismo menú. Si hay cambios, quedan reflejados en una planificación común y no se pierden entre conversaciones.',
        },
        {
          title: 'Adaptado al móvil',
          body: 'El menú se consulta muchas veces desde el teléfono: antes de comprar, al cocinar, al volver del trabajo o cuando alguien pregunta qué toca cenar.',
          items: ['Dashboard rápido.', 'Planificador semanal.', 'Lista de compra y tuppers conectados.'],
        },
        {
          title: 'Menos discusiones y más claridad',
          body: 'Planificar no elimina todos los cambios, pero reduce improvisación. Cada persona sabe qué hay previsto y puede proponer ajustes con más contexto.',
        },
        {
          title: 'Para familias, parejas y pisos compartidos',
          body: 'Aunque esté pensada para familias, la misma lógica sirve para parejas, compañeros de piso o cualquier grupo que quiera coordinar comidas.',
        },
      ],
    },
    healthyWeeklyMenu: {
      key: 'healthyWeeklyMenu',
      slug: 'menu-semanal-saludable',
      navLabel: 'Menú semanal saludable',
      title: 'Menú semanal saludable sin complicarte todos los días',
      description:
        'Ideas y método para organizar un menú semanal saludable, variado y realista con platos guardados, histórico, compra y planificación familiar.',
      eyebrow: 'Comer mejor con planificación',
      intro:
        'Un menú saludable no tiene que ser perfecto ni complicado. Funciona mejor cuando es realista, repetible y combina verduras, legumbres, proteínas, platos rápidos y comidas que encajan con tus horarios.',
      primaryCta: 'Planificar menú saludable',
      secondaryCta: 'Ver manual',
      relatedTitle: 'Guías para comer mejor',
      relatedEyebrow: 'Menú y hábitos',
      highlights: [
        'Variedad semanal sin empezar de cero cada día.',
        'Menos improvisación y menos compras impulsivas.',
        'Histórico para detectar repeticiones y mejorar hábitos.',
      ],
      sections: [
        {
          title: 'Saludable también significa sostenible',
          body: 'Un menú demasiado ambicioso se abandona rápido. La clave es planificar platos que puedas cocinar de verdad, alternando recetas sencillas con alguna preparación más completa.',
        },
        {
          title: 'Equilibrio semanal, no perfección diaria',
          body: 'Puedes revisar la semana completa para alternar verduras, legumbres, pescado, carnes, huevos, platos fríos y cenas ligeras sin obsesionarte con cada comida aislada.',
          items: ['Incluye platos vegetales.', 'Reserva recetas rápidas para días difíciles.', 'Evita repetir siempre las mismas cenas.'],
        },
        {
          title: 'Aprovechar histórico y favoritos',
          body: 'Los platos guardados ayudan a construir una base realista: recetas que ya gustan, que sabes cocinar y que puedes combinar con ideas nuevas.',
        },
        {
          title: 'Planificar la compra para comer mejor',
          body: 'La compra semanal condiciona el menú. Si la lista nace del plan, es más fácil tener ingredientes útiles y evitar decisiones impulsivas de última hora.',
        },
      ],
    },
  },
  en: {
    shoppingList: {
      key: 'shoppingList',
      slug: 'lista-compra-semanal',
      navLabel: 'Weekly shopping list',
      title: 'Automatic weekly shopping list for meal planning',
      description:
        'Create a weekly shopping list from your planned meals, avoid duplicates and buy only what you need for breakfasts, lunches and dinners.',
      eyebrow: 'Organized shopping',
      intro:
        'A useful weekly shopping list starts before you go to the store: decide what you will eat, group ingredients and check what you already have. Menu Diario connects menus, dishes and shopping to reduce forgotten items and improvised purchases.',
      primaryCta: 'Create my shopping list',
      secondaryCta: 'Read guide',
      relatedTitle: 'Guides for better shopping',
      relatedEyebrow: 'Planning and shopping',
      highlights: [
        'Shopping list connected to the real weekly menu.',
        'Fewer duplicate products and less improvisation.',
        'Useful for families, couples, shared flats and batch cooking.',
      ],
      sections: [
        {
          title: 'Why build the list from the menu',
          body: 'When shopping starts from the weekly menu, every product has a reason. It is easier to avoid duplicates, remember essentials and adjust quantities to the meals you will actually cook.',
          items: ['Plan main dishes first.', 'Group repeated ingredients.', 'Check pantry and leftovers before shopping.'],
        },
        {
          title: 'Problems it avoids',
          body: 'It helps avoid arriving at the supermarket without knowing what is missing, buying ingredients that do not belong to any meal or discovering midweek that an important recipe cannot be cooked.',
        },
        {
          title: 'Shared shopping between several people',
          body: 'When several people cook or shop, one shared list avoids scattered messages and shows everyone what is still pending.',
          items: ['Great for families.', 'Practical for couples with different schedules.', 'Useful in shared flats with common meals.'],
        },
        {
          title: 'From weekly menu to cart',
          body: 'Menu Diario is designed so menus, saved dishes, lunchboxes and shopping belong to the same flow. The list is not an isolated note: it comes from what was planned.',
        },
      ],
    },
    aiMealPlanner: {
      key: 'aiMealPlanner',
      slug: 'planificador-menu-ia',
      navLabel: 'AI meal planner',
      title: 'Weekly meal planner with artificial intelligence',
      description:
        'Use AI to fill gaps in your weekly menu, suggest varied meals and adapt ideas to preferences, intolerances and available time.',
      eyebrow: 'AI for everyday meals',
      intro:
        'Artificial intelligence can help when you do not know what to cook, but it works best with context: available days, meal type, recent dishes, group preferences and time for each recipe.',
      primaryCta: 'Try AI planner',
      secondaryCta: 'Read guide',
      relatedTitle: 'More smart planning',
      relatedEyebrow: 'AI and menus',
      highlights: [
        'Ideas to complete unplanned days.',
        'Recommendations based on group context and recent meals.',
        'Less friction when deciding lunches and dinners.',
      ],
      sections: [
        {
          title: 'Useful AI, not a random menu',
          body: 'An AI planner should not generate random dishes. It should respect active meal slots, avoid too much repetition and propose options that fit real everyday life.',
        },
        {
          title: 'Fill menu gaps',
          body: 'AI is especially useful when part of the week is already planned and only a few meals remain undecided. It complements your decisions instead of replacing them.',
          items: ['Fills pending meals.', 'Suggests quicker alternatives.', 'Helps balance variety and routine.'],
        },
        {
          title: 'Preferences and intolerances',
          body: 'Group context makes suggestions more relevant: dishes without specific ingredients, lighter meals, make-ahead options or recipes for several people.',
        },
        {
          title: 'Review before saving',
          body: 'AI proposals should be a starting point. With Menu Diario you can review, adjust and keep only what fits your week.',
        },
      ],
    },
    tupperPlanning: {
      key: 'tupperPlanning',
      slug: 'organizar-tuppers-comidas',
      navLabel: 'Organize lunchboxes',
      title: 'How to organize lunchboxes and leftovers in a weekly menu',
      description:
        'Plan lunchboxes, track freshness, reuse leftovers and place them inside the weekly menu so food does not get forgotten in the fridge.',
      eyebrow: 'Leftovers under control',
      intro:
        'Lunchboxes save time and money, but only if you know what you have, when it should be eaten and which meal it belongs to. Menu Diario helps turn leftovers into visible parts of the menu.',
      primaryCta: 'Organize my lunchboxes',
      secondaryCta: 'Read guide',
      relatedTitle: 'Plan by reusing food',
      relatedEyebrow: 'Lunchboxes and menu',
      highlights: [
        'Visual control of available lunchboxes.',
        'Less food forgotten in the fridge.',
        'Reuse leftovers as planned meals.',
      ],
      sections: [
        {
          title: 'The problem of invisible leftovers',
          body: 'A lunchbox without date or destination gets forgotten. Register it, add portions and assign it to a concrete meal before it loses priority.',
        },
        {
          title: 'Plan leftovers from the start',
          body: 'Some recipes are worth cooking in larger quantities: legumes, stews, soups, rice dishes or meals that keep well. When leftovers are part of the menu, they stop being an accident.',
          items: ['Cook extra portions when useful.', 'Assign lunchboxes to busy days.', 'Track freshness to prioritize consumption.'],
        },
        {
          title: 'Work lunches and quick days',
          body: 'Lunchboxes are especially useful for meals away from home, quick dinners and days when cooking from scratch is not realistic.',
        },
        {
          title: 'Buy less and use more',
          body: 'When you know which lunchboxes are available, the shopping list can be adjusted and you avoid buying ingredients for meals that are already covered.',
        },
      ],
    },
    batchCooking: {
      key: 'batchCooking',
      slug: 'batch-cooking-semanal',
      navLabel: 'Weekly batch cooking',
      title: 'Weekly batch cooking: plan meals to cook less during the week',
      description:
        'Organize a weekly batch cooking session with menu, lunchboxes, shopping list and dishes you can reuse across several days.',
      eyebrow: 'Cook once, solve several days',
      intro:
        'Batch cooking works when it is more than cooking a lot in one day: it needs a weekly plan, combinable dishes, clear portions and a coherent shopping list. Menu Diario helps prepare that structure before cooking starts.',
      primaryCta: 'Plan batch cooking',
      secondaryCta: 'Read guide',
      relatedTitle: 'Weekly organization',
      relatedEyebrow: 'Cooking and planning',
      highlights: [
        'Menu designed to cook less during the week.',
        'Portions and lunchboxes visible in planning.',
        'Shopping aligned with what you will prepare.',
      ],
      sections: [
        {
          title: 'Choose recipes that reuse well',
          body: 'Not every dish is good for batch cooking. Prioritize versatile bases, stews, roasted vegetables, grains, legumes and proteins that can combine in several ways.',
        },
        {
          title: 'Plan by blocks',
          body: 'An efficient session separates base preparations, complete dishes and complements. That lets you solve different meals without eating exactly the same thing every day.',
          items: ['Bases: rice, pasta, potato or quinoa.', 'Proteins: chicken, legumes, fish or tofu.', 'Complements: vegetables, sauces and salads.'],
        },
        {
          title: 'Assign cooked food to the calendar',
          body: 'Planning prevents lunchboxes from having no destination. Each portion should have an approximate day or a consumption priority.',
        },
        {
          title: 'Reduce decisions during the week',
          body: 'The goal is not perfect cooking. The goal is starting Monday with part of the work done and fewer decisions pending.',
        },
      ],
    },
    familyMealApp: {
      key: 'familyMealApp',
      slug: 'app-menu-semanal-familiar',
      navLabel: 'Family menu app',
      title: 'App to organize the family weekly menu from your phone',
      description:
        'Menu Diario is a web app for organizing a family weekly menu, coordinating meals, saving dishes and sharing changes from your phone.',
      eyebrow: 'Shared family menu',
      intro:
        'When several people eat together, deciding the menu through messages or loose notes creates confusion. A family weekly menu app centralizes lunches, dinners, frequent dishes, lunchboxes and last-minute changes.',
      primaryCta: 'Create family menu',
      secondaryCta: 'How it works',
      relatedTitle: 'More ways to organize',
      relatedEyebrow: 'Family and groups',
      highlights: [
        'One shared view of the menu for the whole family.',
        'Shared editing without endless message threads.',
        'Dish history to repeat what worked.',
      ],
      sections: [
        {
          title: 'One place to decide what to eat',
          body: 'The main advantage is that everyone checks the same menu. Changes are reflected in a common plan instead of getting lost in conversations.',
        },
        {
          title: 'Made for mobile use',
          body: 'Menus are often checked from a phone: before shopping, while cooking, after work or when somebody asks what is for dinner.',
          items: ['Fast dashboard.', 'Weekly planner.', 'Shopping list and lunchboxes connected.'],
        },
        {
          title: 'Less arguing and more clarity',
          body: 'Planning does not remove every change, but it reduces improvisation. Everyone knows what is planned and can suggest adjustments with more context.',
        },
        {
          title: 'For families, couples and shared flats',
          body: 'Although designed with families in mind, the same logic works for couples, flatmates or any group that wants to coordinate meals.',
        },
      ],
    },
    healthyWeeklyMenu: {
      key: 'healthyWeeklyMenu',
      slug: 'menu-semanal-saludable',
      navLabel: 'Healthy weekly menu',
      title: 'Healthy weekly menu without overcomplicating every day',
      description:
        'Ideas and method to organize a healthy, varied and realistic weekly menu with saved dishes, history, shopping and family planning.',
      eyebrow: 'Eat better through planning',
      intro:
        'A healthy menu does not need to be perfect or complicated. It works best when it is realistic, repeatable and combines vegetables, legumes, proteins, quick meals and dishes that fit your schedule.',
      primaryCta: 'Plan healthy menu',
      secondaryCta: 'Read guide',
      relatedTitle: 'Guides to eat better',
      relatedEyebrow: 'Menu and habits',
      highlights: [
        'Weekly variety without starting from zero every day.',
        'Less improvisation and fewer impulse purchases.',
        'History to spot repetitions and improve habits.',
      ],
      sections: [
        {
          title: 'Healthy also means sustainable',
          body: 'A menu that is too ambitious is quickly abandoned. Plan dishes you can actually cook, alternating simple recipes with a few more complete preparations.',
        },
        {
          title: 'Weekly balance, not daily perfection',
          body: 'Looking at the full week helps alternate vegetables, legumes, fish, meat, eggs, cold dishes and lighter dinners without obsessing over each isolated meal.',
          items: ['Include vegetable-based dishes.', 'Save quick recipes for difficult days.', 'Avoid repeating the same dinners all the time.'],
        },
        {
          title: 'Use history and favorites',
          body: 'Saved dishes help build a realistic base: recipes people already like, you know how to cook and can combine with fresh ideas.',
        },
        {
          title: 'Plan shopping to eat better',
          body: 'Weekly shopping shapes the menu. When the list comes from the plan, it is easier to have useful ingredients and avoid last-minute impulse decisions.',
        },
      ],
    },
  },
} as const;
