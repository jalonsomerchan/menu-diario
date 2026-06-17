import type { Locale } from '../config/site';

export type PublicCookingSeoPageKind = 'recipe' | 'tip';

export type PublicCookingSeoPage = {
  kind: PublicCookingSeoPageKind;
  slug: string;
  navLabel: string;
  title: string;
  description: string;
  eyebrow: string;
  intro: string;
  highlights: string[];
  ingredients: string[];
  steps: string[];
  tips: string[];
  appUse: string;
  primaryCta: string;
  secondaryCta: string;
  minutes?: number;
  difficulty?: string;
};

type RecipeSeed = [slug: string, name: string, meal: string, minutes: number, difficulty: string];
type TipSeed = [slug: string, title: string, topic: string];

const recipeSeeds: RecipeSeed[] = [
  ['ensalada-lentejas-aguacate', 'Ensalada de lentejas con aguacate', 'comida fria', 20, 'facil'],
  ['pollo-limon-patatas', 'Pollo al limon con patatas', 'comida familiar', 45, 'facil'],
  ['crema-calabacin-zanahoria', 'Crema de calabacin y zanahoria', 'cena ligera', 35, 'facil'],
  ['arroz-verduras-huevo', 'Arroz con verduras y huevo', 'comida rapida', 30, 'facil'],
  ['merluza-horno-verduras', 'Merluza al horno con verduras', 'comida ligera', 30, 'facil'],
  ['garbanzos-espinacas', 'Garbanzos con espinacas', 'comida de cuchara', 35, 'facil'],
  ['pasta-brocoli-atun', 'Pasta con brocoli y atun', 'comida de despensa', 25, 'facil'],
  ['tortilla-calabacin', 'Tortilla de calabacin', 'cena facil', 25, 'facil'],
  ['salmon-arroz-lima', 'Salmon con arroz y lima', 'comida equilibrada', 30, 'media'],
  ['cuscus-pollo-verduras', 'Cuscus con pollo y verduras', 'comida para tupper', 30, 'facil'],
  ['judias-verdes-jamon-huevo', 'Judias verdes con jamon y huevo', 'cena ligera', 25, 'facil'],
  ['quinoa-verduras-feta', 'Quinoa con verduras y feta', 'comida saludable', 30, 'facil'],
  ['lasana-berenjena', 'Lasana de berenjena', 'comida de domingo', 55, 'media'],
  ['crema-lentejas-curry', 'Crema de lentejas al curry', 'cena de aprovechamiento', 30, 'facil'],
  ['tacos-pollo-guacamole', 'Tacos de pollo con guacamole', 'cena informal', 25, 'facil'],
  ['bacalao-tomate-pimientos', 'Bacalao con tomate y pimientos', 'comida con pescado', 40, 'media'],
  ['risotto-champinones', 'Risotto de champinones sencillo', 'comida de fin de semana', 35, 'media'],
  ['ensalada-pasta-pavo', 'Ensalada de pasta con pavo', 'comida fria', 20, 'facil'],
  ['hamburguesas-lentejas', 'Hamburguesas de lentejas', 'cena vegetal', 35, 'media'],
  ['fajitas-verduras-queso', 'Fajitas de verduras y queso', 'cena rapida', 25, 'facil'],
  ['albondigas-salsa-verduras', 'Albondigas en salsa de verduras', 'comida familiar', 50, 'media'],
  ['sopa-fideos-pollo', 'Sopa de fideos con pollo', 'cena reconfortante', 30, 'facil'],
  ['huevos-plato-guisantes', 'Huevos al plato con guisantes', 'cena barata', 25, 'facil'],
  ['ensalada-arroz-atun', 'Ensalada de arroz con atun', 'comida para llevar', 20, 'facil'],
  ['pavo-manzana-curry', 'Pavo con manzana y curry', 'comida diferente', 30, 'facil'],
  ['berenjenas-rellenas-atun', 'Berenjenas rellenas de atun', 'comida al horno', 45, 'media'],
  ['potaje-garbanzos-calabaza', 'Potaje de garbanzos y calabaza', 'comida de cuchara', 45, 'facil'],
  ['wraps-salmon-queso', 'Wraps de salmon y queso crema', 'cena fria', 15, 'facil'],
  ['macarrones-verduras-tomate', 'Macarrones con verduras y tomate', 'comida familiar', 30, 'facil'],
  ['pollo-teriyaki-casero', 'Pollo teriyaki casero', 'comida rapida', 30, 'facil'],
  ['crepes-salados-espinacas', 'Crepes salados de espinacas', 'cena especial', 40, 'media'],
  ['ensalada-patata-huevo', 'Ensalada de patata y huevo', 'comida fria', 30, 'facil'],
  ['lomo-salsa-champinones', 'Lomo en salsa de champinones', 'comida familiar', 35, 'media'],
  ['arroz-caldoso-marisco', 'Arroz caldoso de marisco sencillo', 'comida de fin de semana', 45, 'media'],
  ['tofu-salteado-verduras', 'Tofu salteado con verduras', 'cena vegetal', 25, 'facil'],
  ['pollo-asado-sobras', 'Pollo asado pensado para sobras', 'batch cooking', 60, 'facil'],
  ['croquetas-pollo-caseras', 'Croquetas de pollo de aprovechamiento', 'aprovechamiento', 60, 'media'],
  ['pisto-huevo', 'Pisto con huevo', 'cena sencilla', 40, 'facil'],
  ['merluza-salsa-verde', 'Merluza en salsa verde', 'comida con pescado', 30, 'media'],
  ['ensalada-garbanzos-bacalao', 'Ensalada de garbanzos y bacalao', 'comida fria', 20, 'facil'],
  ['pizza-casera-verduras', 'Pizza casera de verduras', 'cena familiar', 40, 'facil'],
  ['sarten-patata-salchichas', 'Sarten de patata, verduras y salchichas', 'cena rapida', 30, 'facil'],
  ['curry-garbanzos-arroz', 'Curry de garbanzos con arroz', 'comida vegetal', 35, 'facil'],
  ['tallarines-verduras-gambas', 'Tallarines con verduras y gambas', 'comida rapida', 25, 'facil'],
  ['crema-calabaza-manzana', 'Crema de calabaza y manzana', 'cena de temporada', 35, 'facil'],
  ['pollo-cuscus-almendras', 'Pollo con cuscus y almendras', 'comida equilibrada', 30, 'facil'],
  ['ensalada-tomate-mozzarella', 'Ensalada de tomate y mozzarella', 'cena ligera', 10, 'facil'],
  ['tortilla-patata-cebolla', 'Tortilla de patata con cebolla', 'clasico semanal', 45, 'media'],
  ['arroz-pollo-verduras', 'Arroz con pollo y verduras', 'comida de diario', 40, 'facil'],
  ['ensalada-quinoa-pollo', 'Ensalada de quinoa con pollo', 'comida para llevar', 25, 'facil'],
  ['hummus-verduras-pan', 'Hummus con verduras y pan pita', 'cena informal', 15, 'facil'],
  ['pescado-papillote', 'Pescado en papillote', 'cena ligera', 25, 'facil'],
  ['pasta-pesto-pollo', 'Pasta al pesto con pollo', 'comida rapida', 25, 'facil'],
  ['sopa-tomate-albahaca', 'Sopa de tomate y albahaca', 'cena ligera', 30, 'facil'],
  ['burritos-frijoles-arroz', 'Burritos de frijoles y arroz', 'cena economica', 30, 'facil'],
  ['guiso-pavo-patatas', 'Guiso de pavo con patatas', 'comida de cuchara', 45, 'facil'],
  ['verduras-asadas-huevo', 'Verduras asadas con huevo', 'cena de aprovechamiento', 35, 'facil'],
  ['noodles-pollo-verduras', 'Noodles con pollo y verduras', 'comida rapida', 25, 'facil'],
  ['ensalada-remolacha-queso', 'Ensalada de remolacha y queso', 'cena fria', 15, 'facil'],
  ['alubias-blancas-verduras', 'Alubias blancas con verduras', 'comida economica', 40, 'facil'],
  ['rollitos-tortilla-pavo', 'Rollitos de tortilla con pavo', 'cena rapida', 15, 'facil'],
  ['calamares-arroz-verduras', 'Calamares con arroz y verduras', 'comida de pescado', 35, 'media'],
  ['pollo-mostaza-miel', 'Pollo a la mostaza y miel', 'comida familiar', 35, 'facil'],
  ['ensalada-cuscus-mediterranea', 'Ensalada mediterranea de cuscus', 'comida fria', 20, 'facil'],
  ['crema-puerros-patata', 'Crema de puerros y patata', 'cena suave', 35, 'facil'],
  ['arroz-horno-garbanzos', 'Arroz al horno con garbanzos', 'comida completa', 50, 'media'],
  ['pasta-sardinas-limon', 'Pasta con sardinas y limon', 'comida de despensa', 20, 'facil'],
  ['pechuga-rellena-espinacas', 'Pechuga rellena de espinacas', 'comida especial', 40, 'media'],
  ['ensalada-pollo-manzana', 'Ensalada de pollo y manzana', 'comida ligera', 20, 'facil'],
  ['guisantes-jamon-huevo', 'Guisantes con jamon y huevo', 'cena rapida', 20, 'facil'],
];

const tipSeeds: TipSeed[] = [
  ['como-planificar-menu-semanal-realista', 'Como planificar un menu semanal realista', 'planificacion'],
  ['como-hacer-lista-compra-sin-olvidos', 'Como hacer la lista de la compra sin olvidos', 'compra'],
  ['ideas-cenas-rapidas-entre-semana', 'Ideas para cenas rapidas entre semana', 'cenas rapidas'],
  ['organizar-tuppers-nevera', 'Como organizar tuppers en la nevera', 'tuppers'],
  ['batch-cooking-principiantes', 'Batch cooking para principiantes', 'batch cooking'],
  ['evitar-repetir-comidas', 'Como evitar repetir siempre las mismas comidas', 'variedad'],
  ['menu-semanal-para-familias', 'Menu semanal para familias con horarios distintos', 'familia'],
  ['aprovechar-sobras-sin-aburrirse', 'Como aprovechar sobras sin aburrirse', 'aprovechamiento'],
  ['despensa-basica-menu-semanal', 'Despensa basica para un menu semanal', 'despensa'],
  ['comprar-menos-comida', 'Como comprar menos comida y aprovechar mejor', 'ahorro'],
  ['organizar-desayunos-semana', 'Como organizar desayunos de la semana', 'desayunos'],
  ['cenas-ligeras-planificadas', 'Como planificar cenas ligeras', 'cenas ligeras'],
  ['comidas-para-llevar-trabajo', 'Comidas para llevar al trabajo sin complicarse', 'tuppers'],
  ['menu-semanal-barato', 'Como hacer un menu semanal barato', 'ahorro'],
  ['cocinar-verduras-mas-facil', 'Como cocinar mas verduras sin complicarte', 'verduras'],
  ['planificar-comidas-con-ninos', 'Planificar comidas cuando hay ninos', 'familia'],
  ['rotar-platos-favoritos', 'Como rotar platos favoritos sin cansarte', 'favoritos'],
  ['organizar-menu-pareja', 'Organizar el menu semanal en pareja', 'pareja'],
  ['planificar-comida-domingo', 'Planificar la comida del domingo', 'domingo'],
  ['menu-semanal-sin-horno', 'Menu semanal sin usar horno', 'cocina facil'],
  ['congelar-comidas-correctamente', 'Como congelar comidas planificadas', 'congelador'],
  ['descongelar-sin-improvisar', 'Como descongelar sin improvisar', 'congelador'],
  ['cocinar-una-vez-comer-dos', 'Cocinar una vez y comer dos dias', 'batch cooking'],
  ['menu-semanal-verano', 'Ideas para menu semanal de verano', 'temporada'],
  ['menu-semanal-invierno', 'Ideas para menu semanal de invierno', 'temporada'],
  ['organizar-comidas-piso-compartido', 'Organizar comidas en un piso compartido', 'grupo'],
  ['menu-semanal-con-intolerancias', 'Planificar menu semanal con intolerancias', 'preferencias'],
  ['recetas-base-semana', 'Recetas base para resolver la semana', 'bases'],
  ['como-usar-historico-comidas', 'Como usar el historico para comer mejor', 'historico'],
  ['preparar-menu-antes-supermercado', 'Preparar el menu antes de ir al supermercado', 'compra'],
];

const pantry = ['aceite de oliva', 'sal', 'pimienta', 'ajo', 'cebolla'];
const genericTipActions = ['Decide primero en que dia encaja', 'Revisa si hay sobras o tuppers antes de comprar', 'Guarda la idea para repetirla sin improvisar'];

export const publicCookingSeoPageCount = recipeSeeds.length + tipSeeds.length;

export function getCookingSeoIndexRoute(locale: Locale) {
  return locale === 'en' ? '/recipes' : '/recetas';
}

export function getCookingSeoIndexLabel(locale: Locale) {
  return locale === 'en' ? 'Recipes and tips' : 'Recetas y consejos';
}

export function getCookingSeoIndexMeta(locale: Locale) {
  return locale === 'en'
    ? {
        title: 'Cooking tips and recipe ideas for weekly meal planning',
        description: 'More than 100 public recipe and cooking advice pages to plan weekly menus, reuse leftovers, create shopping lists and discover Menu Diario.',
      }
    : {
        title: 'Recetas y consejos de cocina para organizar tu menu semanal',
        description: 'Mas de 100 recetas, ideas y consejos de cocina para planificar menus semanales, aprovechar tuppers, hacer la compra y usar Menu Diario en el dia a dia.',
      };
}

export function getCookingSeoPageRoute(locale: Locale, page: Pick<PublicCookingSeoPage, 'slug'>) {
  return `${getCookingSeoIndexRoute(locale)}/${page.slug}`;
}

function buildRecipeIngredients(name: string) {
  const key = name.toLowerCase();
  const extra = key.includes('ensalada') ? ['tomate', 'lechuga o brotes', 'vinagreta']
    : key.includes('pollo') ? ['pollo', 'arroz o patata', 'verduras de temporada']
      : key.includes('pasta') || key.includes('macarrones') ? ['pasta', 'queso rallado', 'verduras']
        : key.includes('arroz') ? ['arroz', 'caldo', 'verduras']
          : key.includes('crema') || key.includes('sopa') ? ['verduras', 'caldo', 'patata o legumbre']
            : key.includes('pescado') || key.includes('merluza') || key.includes('bacalao') || key.includes('salmon') ? ['pescado', 'limon', 'verduras']
              : ['verduras de temporada', 'proteina al gusto', 'guarnicion sencilla'];
  return [...extra, ...pantry];
}

function buildRecipePage([slug, name, meal, minutes, difficulty]: RecipeSeed, locale: Locale): PublicCookingSeoPage {
  const ingredients = buildRecipeIngredients(name);
  if (locale === 'en') {
    return {
      kind: 'recipe',
      slug,
      navLabel: name,
      title: `${name}: weekly meal planning recipe`,
      description: `Recipe idea for ${name.toLowerCase()} with ingredients, steps and planning tips to add it to a weekly menu with Menu Diario.`,
      eyebrow: 'Planning-friendly recipe',
      intro: `${name} is a practical option for ${meal}. It helps you decide what to cook before shopping and keep the week visible in one shared planner.`,
      highlights: [`Ready in about ${minutes} minutes.`, `Difficulty: ${difficulty}.`, 'Useful for weekly menus, leftovers and shopping lists.'],
      ingredients,
      steps: ['Prepare and wash the ingredients.', `Cook the base of ${name.toLowerCase()} until it is tender and tasty.`, 'Adjust seasoning and serve with a simple garnish.', 'Save it in Menu Diario and assign it to a day of the week.'],
      tips: ['Add it to the planner before shopping.', 'Cook one extra serving if it keeps well.', 'Use the history to avoid repeating it too often.'],
      appUse: 'Menu Diario helps you save this idea, place it in the weekly planner, reuse it later and turn the planned menu into a shopping list.',
      primaryCta: 'Use Menu Diario',
      secondaryCta: 'Open planner',
      minutes,
      difficulty,
    };
  }

  return {
    kind: 'recipe',
    slug,
    navLabel: name,
    title: `${name}: receta facil para planificar el menu semanal`,
    description: `Receta de ${name.toLowerCase()} con ingredientes, pasos y consejos para anadirla a tu menu semanal en Menu Diario.`,
    eyebrow: 'Receta para planificar',
    intro: `${name} es una opcion practica para ${meal}. Te ayuda a decidir que cocinar antes de comprar y a mantener la semana visible en un planificador compartido.`,
    highlights: [`Lista en unos ${minutes} minutos.`, `Dificultad: ${difficulty}.`, 'Util para menu semanal, tuppers y lista de compra.'],
    ingredients,
    steps: ['Prepara y lava los ingredientes antes de empezar.', `Cocina la base de ${name.toLowerCase()} hasta que quede tierna y sabrosa.`, 'Ajusta sal, textura y acompanamiento antes de servir.', 'Guarda la idea en Menu Diario y asignala a un dia de la semana.'],
    tips: ['Anadela al planificador antes de hacer la compra.', 'Cocina una racion extra si aguanta bien.', 'Consulta el historico para no repetirla demasiado.'],
    appUse: 'Menu Diario te ayuda a guardar esta receta, colocarla en el planificador semanal, reutilizarla mas adelante y convertir el menu previsto en lista de compra.',
    primaryCta: 'Usar Menu Diario gratis',
    secondaryCta: 'Ver planificador',
    minutes,
    difficulty,
  };
}

function buildTipPage([slug, title, topic]: TipSeed, locale: Locale): PublicCookingSeoPage {
  if (locale === 'en') {
    return {
      kind: 'tip',
      slug,
      navLabel: title,
      title: `${title}: practical cooking advice`,
      description: `Practical advice about ${topic} for planning meals, shopping better and using Menu Diario to organize the week.`,
      eyebrow: 'Cooking advice',
      intro: `${title} is easier when the weekly plan, leftovers and shopping list live in the same place. This guide explains a practical method you can apply today.`,
      highlights: ['Designed for real weekly planning.', 'Connects cooking, shopping and leftovers.', 'Includes a clear way to use Menu Diario.'],
      ingredients: [],
      steps: genericTipActions.map((action) => `${action}.`),
      tips: ['Review the weekly planner before changing the shopping list.', 'Keep repeated decisions as saved dishes.', 'Use shared planning when more than one person eats at home.'],
      appUse: 'Menu Diario keeps these decisions in a shared planner, so recipes, leftovers, shopping lists and AI suggestions stay connected.',
      primaryCta: 'Use Menu Diario',
      secondaryCta: 'Open planner',
    };
  }

  return {
    kind: 'tip',
    slug,
    navLabel: title,
    title: `${title}: consejo practico para cocinar mejor`,
    description: `Consejo practico sobre ${topic} para planificar comidas, comprar mejor y usar Menu Diario para organizar la semana.`,
    eyebrow: 'Consejo de cocina',
    intro: `${title} es mas facil cuando el menu semanal, los tuppers y la lista de compra estan en el mismo sitio. Esta guia resume un metodo practico para aplicarlo hoy.`,
    highlights: ['Pensado para planificacion semanal real.', 'Conecta cocina, compra y aprovechamiento.', 'Incluye una forma clara de usar Menu Diario.'],
    ingredients: [],
    steps: genericTipActions.map((action) => `${action}.`),
    tips: ['Revisa el planificador antes de tocar la lista de compra.', 'Guarda como platos las decisiones que se repiten.', 'Usa la planificacion compartida si comen varias personas.'],
    appUse: 'Menu Diario mantiene estas decisiones en un planificador compartido para que recetas, tuppers, lista de compra y sugerencias con IA trabajen juntas.',
    primaryCta: 'Usar Menu Diario gratis',
    secondaryCta: 'Ver planificador',
  };
}

export function getPublicCookingSeoPages(locale: Locale): PublicCookingSeoPage[] {
  return [...recipeSeeds.map((seed) => buildRecipePage(seed, locale)), ...tipSeeds.map((seed) => buildTipPage(seed, locale))];
}

export function getPublicCookingSeoPage(locale: Locale, slug: string): PublicCookingSeoPage {
  const page = getPublicCookingSeoPages(locale).find((item) => item.slug === slug);
  if (!page) {
    throw new Error(`Unknown public cooking SEO page: ${slug}`);
  }
  return page;
}

export function getPublicCookingSeoRelatedPages(locale: Locale, slug: string, limit = 4): PublicCookingSeoPage[] {
  const pages = getPublicCookingSeoPages(locale);
  const currentIndex = Math.max(0, pages.findIndex((page) => page.slug === slug));
  const related: PublicCookingSeoPage[] = [];
  for (let offset = 1; related.length < limit && offset < pages.length; offset += 1) {
    related.push(pages[(currentIndex + offset) % pages.length]);
  }
  return related;
}
