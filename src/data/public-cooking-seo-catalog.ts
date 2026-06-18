import type { Locale } from '../config/site';
import {
  getCookingSeoIndexLabel,
  getCookingSeoIndexRoute,
  getCookingSeoPageRoute,
  getPublicCookingSeoPages as getBasePublicCookingSeoPages,
  type PublicCookingSeoPage,
} from './public-cooking-seo-pages';

export type { PublicCookingSeoPage, PublicCookingSeoPageKind } from './public-cooking-seo-pages';
export { getCookingSeoIndexLabel, getCookingSeoIndexRoute, getCookingSeoPageRoute };

type ExtraRecipeBase = [slug: string, name: string, ingredient: string];
type ExtraRecipeStyle = [slug: string, suffix: string, meal: string, minutes: number, difficulty: string];

const extraRecipeBases: ExtraRecipeBase[] = [
  ['pollo', 'Pollo', 'pollo'],
  ['pavo', 'Pavo', 'pavo'],
  ['merluza', 'Merluza', 'pescado blanco'],
  ['salmon', 'Salmon', 'salmon'],
  ['atun', 'Atun', 'atun'],
  ['garbanzos', 'Garbanzos', 'garbanzos cocidos'],
  ['lentejas', 'Lentejas', 'lentejas cocidas'],
  ['alubias', 'Alubias', 'alubias cocidas'],
  ['arroz', 'Arroz', 'arroz'],
  ['pasta', 'Pasta', 'pasta'],
  ['quinoa', 'Quinoa', 'quinoa'],
  ['cuscus', 'Cuscus', 'cuscus'],
  ['patata', 'Patata', 'patata'],
  ['calabacin', 'Calabacin', 'calabacin'],
  ['berenjena', 'Berenjena', 'berenjena'],
  ['huevo', 'Huevo', 'huevos'],
  ['tofu', 'Tofu', 'tofu'],
  ['ternera', 'Ternera', 'ternera'],
  ['bacalao', 'Bacalao', 'bacalao'],
  ['verduras', 'Verduras', 'verduras de temporada'],
];

const extraRecipeStyles: ExtraRecipeStyle[] = [
  ['verduras-temporada', 'con verduras de temporada', 'comida saludable', 30, 'facil'],
  ['horno-sencillo', 'al horno sencillo', 'comida familiar', 45, 'facil'],
  ['ensalada-fria', 'en ensalada fria', 'comida fria', 20, 'facil'],
  ['arroz-suave', 'con arroz suave', 'comida completa', 35, 'facil'],
  ['tupper-semanal', 'para tupper semanal', 'comida para llevar', 30, 'facil'],
];

const extraRecipeCount = extraRecipeBases.length * extraRecipeStyles.length;

function getExtraRecipeSeeds() {
  return extraRecipeBases.flatMap(([baseSlug, baseName, ingredient]) =>
    extraRecipeStyles.map(([styleSlug, suffix, meal, minutes, difficulty]) => ({
      slug: `${baseSlug}-${styleSlug}`,
      name: `${baseName} ${suffix}`,
      ingredient,
      meal,
      minutes,
      difficulty,
    }))
  );
}

function getExtraRecipeIngredients(ingredient: string) {
  return [ingredient, 'verduras de temporada', 'guarnicion sencilla', 'aceite de oliva', 'sal', 'pimienta'];
}

function buildExtraRecipePage(seed: ReturnType<typeof getExtraRecipeSeeds>[number], locale: Locale): PublicCookingSeoPage {
  if (locale === 'en') {
    return {
      kind: 'recipe',
      slug: seed.slug,
      navLabel: seed.name,
      title: `${seed.name}: easy weekly meal recipe`,
      description: `Public recipe idea for ${seed.name.toLowerCase()} with ingredients, steps and planning tips to organize weekly menus in Menu Diario.`,
      eyebrow: 'Weekly recipe idea',
      intro: `${seed.name} is a practical idea for ${seed.meal}. It is designed to decide meals before shopping and reuse the plan in Menu Diario.`,
      highlights: [`Ready in about ${seed.minutes} minutes.`, `Difficulty: ${seed.difficulty}.`, 'Useful for shopping lists, leftovers and shared planning.'],
      ingredients: getExtraRecipeIngredients(seed.ingredient),
      steps: ['Prepare the ingredients and keep the portions visible.', `Cook ${seed.ingredient} with a simple base and seasonal vegetables.`, 'Add a side dish and adjust seasoning before serving.', 'Save the recipe in Menu Diario and assign it to your weekly planner.'],
      tips: ['Use it to fill an empty day in the planner.', 'Cook one extra serving if it works as leftovers.', 'Add ingredients to the shopping list before going to the supermarket.'],
      appUse: 'Menu Diario helps you save this recipe, plan when to cook it, reuse it later and generate the shopping list from the weekly menu.',
      primaryCta: 'Use Menu Diario',
      secondaryCta: 'Open planner',
      minutes: seed.minutes,
      difficulty: seed.difficulty,
    };
  }

  return {
    kind: 'recipe',
    slug: seed.slug,
    navLabel: seed.name,
    title: `${seed.name}: receta facil para el menu semanal`,
    description: `Receta publica de ${seed.name.toLowerCase()} con ingredientes, pasos y consejos para organizar el menu semanal en Menu Diario.`,
    eyebrow: 'Idea de receta semanal',
    intro: `${seed.name} es una idea practica para ${seed.meal}. Esta pensada para decidir comidas antes de comprar y reutilizar el plan en Menu Diario.`,
    highlights: [`Lista en unos ${seed.minutes} minutos.`, `Dificultad: ${seed.difficulty}.`, 'Util para lista de compra, tuppers y planificacion compartida.'],
    ingredients: getExtraRecipeIngredients(seed.ingredient),
    steps: ['Prepara los ingredientes y deja claras las raciones.', `Cocina ${seed.ingredient} con una base sencilla y verduras de temporada.`, 'Anade una guarnicion y ajusta sal antes de servir.', 'Guarda la receta en Menu Diario y asignala al planificador semanal.'],
    tips: ['Usala para rellenar un hueco vacio del planificador.', 'Cocina una racion extra si funciona bien como sobra.', 'Pasa los ingredientes a la lista de compra antes de ir al supermercado.'],
    appUse: 'Menu Diario te ayuda a guardar esta receta, planificar cuando cocinarla, repetirla mas adelante y generar la lista de compra desde el menu semanal.',
    primaryCta: 'Usar Menu Diario gratis',
    secondaryCta: 'Ver planificador',
    minutes: seed.minutes,
    difficulty: seed.difficulty,
  };
}

function getExtraRecipePages(locale: Locale) {
  return getExtraRecipeSeeds().map((seed) => buildExtraRecipePage(seed, locale));
}

export const publicCookingSeoPageCount = 100 + extraRecipeCount;

export function getCookingRecipeIndexRoute(locale: Locale) {
  return locale === 'en' ? '/recipes/recipe-index' : '/recetas/indice';
}

export function getCookingSeoIndexMeta(locale: Locale) {
  return locale === 'en'
    ? {
        title: 'Cooking tips and recipe ideas for weekly meal planning',
        description: 'More than 200 public recipe and cooking advice pages to plan weekly menus, reuse leftovers, create shopping lists and discover Menu Diario.',
      }
    : {
        title: 'Recetas y consejos de cocina para organizar tu menu semanal',
        description: 'Mas de 200 recetas, ideas y consejos de cocina para planificar menus semanales, aprovechar tuppers, hacer la compra y usar Menu Diario en el dia a dia.',
      };
}

export function getCookingRecipeIndexMeta(locale: Locale) {
  return locale === 'en'
    ? {
        title: 'Recipe index for weekly meal planning',
        description: 'Alphabetical index with more than 170 recipe ideas for weekly meal planning, shopping lists, leftovers and shared menus in Menu Diario.',
      }
    : {
        title: 'Indice de recetas para planificar el menu semanal',
        description: 'Indice alfabetico con mas de 170 recetas para planificar menus semanales, lista de compra, tuppers y comidas compartidas en Menu Diario.',
      };
}

export function getPublicCookingSeoPages(locale: Locale): PublicCookingSeoPage[] {
  return [...getBasePublicCookingSeoPages(locale), ...getExtraRecipePages(locale)];
}

export function getPublicCookingSeoRecipePages(locale: Locale): PublicCookingSeoPage[] {
  return getPublicCookingSeoPages(locale).filter((page) => page.kind === 'recipe');
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
