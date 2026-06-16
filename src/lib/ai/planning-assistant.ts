import { cleanDishName, normalizeDishName } from '../dishes/helpers.mjs';
import { getDailyOptionPromptHints } from '../menu/daily-options.ts';
import { normalizeDay } from '../menu/normalizers.ts';
import type { DailyMenu, DailyOption, Dish, MealSlot } from '../menu/types';

const maxPlanningMeals = 42;
const maxCatalogDishes = 84;
const maxTasteProfileDishes = 18;
const maxRecentDishesToAvoid = 21;
const maxSuggestedDishes = 5;
const maxFoodIntolerancesPromptLength = 500;

export type PlanningRecommendationMode = 'own' | 'new' | 'mix';

export type PlanningRecommendationInput = {
  dayKey: string;
  meal: MealSlot;
};

export type PlanningRecommendationDish = {
  name: string;
  isNew: boolean;
  scope: Dish['scope'] | 'new';
  isGlobal: boolean;
};

export type PlanningRecommendation = {
  dayKey: string;
  meal: MealSlot;
  dishes: PlanningRecommendationDish[];
  reason: string;
};

type PlanningRecommendationResponseDish = {
  name: string;
  isNew: boolean;
};

type PlanningRecommendationResponseEntry = {
  dayKey: string;
  meal: MealSlot;
  dishes: PlanningRecommendationResponseDish[];
  reason: string;
};

export type PlanningRecommendationResponse = {
  recommendations: PlanningRecommendationResponseEntry[];
};

export function buildPlanningAssistantPrompt(input: {
  locale: string;
  mode: PlanningRecommendationMode;
  recommendationCount: number;
  pendingMeals: PlanningRecommendationInput[];
  days: Record<string, Partial<DailyMenu> | undefined>;
  dishes: Dish[];
  dailyOptions?: DailyOption[];
  mealLabels: Record<MealSlot, string>;
  foodIntolerances?: string;
}) {
  const recommendationCount = clampRecommendationCount(input.recommendationCount);
  const pendingMeals = input.pendingMeals
    .slice(0, maxPlanningMeals)
    .map((slot) => `- ${slot.dayKey} | ${slot.meal} | ${input.mealLabels[slot.meal] ?? slot.meal}`)
    .join('\n');
  const currentMeals = describeCurrentMeals(input.days, input.pendingMeals, input.mealLabels, input.dailyOptions ?? []);
  const catalogSection = describeCatalog(input.dishes, input.mode);
  const knownNames = getVisibleDishes(input.dishes)
    .slice(0, maxCatalogDishes)
    .map((dish) => `- ${dish.name}`)
    .join('\n');
  const tasteProfile = getTasteProfile(input.dishes);
  const recentDishes = describeRecentDishes(input.dishes);
  const foodIntolerances = describeFoodIntolerances(input.foodIntolerances);

  return [
    `Locale: ${input.locale}.`,
    'Task: plan pending meals for a weekly menu app.',
    `Recommendation mode: ${describeMode(input.mode)}.`,
    `Return up to ${recommendationCount} dishes per slot.`,
    'Prioritize practical, varied, balanced dishes that make sense for everyday home planning.',
    'Avoid repeating the same dish across nearby slots when possible.',
    recentDishes
      ? 'Use the recently used saved dishes as avoidance context: avoid repeating them unless the catalog is too small or the constraints require it.'
      : 'No recent saved dish usage was provided.',
    foodIntolerances
      ? 'Use the food restrictions as hard constraints and avoid dishes that conflict with them.'
      : 'No food restrictions were provided.',
    getModeRules(input.mode, recommendationCount),
    `Return JSON with shape {"recommendations":[{"dayKey":"YYYY-MM-DD","meal":"breakfast|lunch|dinner","dishes":[{"name":"Dish","isNew":true}],"reason":"short string"}]}.`,
    'Pending slots to plan:',
    pendingMeals || '- none',
    'Already planned meals in this range:',
    currentMeals || '- none',
    'Recently used saved dishes to avoid before reusing:',
    recentDishes || '- none',
    'Day planning conditions. Treat these as planning constraints: late arrival means prioritize quick meals, eating out means avoid planning that slot, kids day means family-friendly, training means nourishing, no-cook means cold/no-cook or very low effort.',
    describeDayOptions(input.days, input.pendingMeals, input.dailyOptions ?? []) || '- none',
    'Food restrictions:',
    foodIntolerances || '- none',
    'Taste profile inferred from saved dishes:',
    tasteProfile || '- none',
    'Saved dishes available to reuse when allowed:',
    catalogSection,
    'Known dish names already in the catalog. Any dish in this list is NOT a new dish:',
    knownNames || '- none',
  ].join('\n\n');
}

export function isPlanningRecommendationResponse(value: unknown): value is PlanningRecommendationResponse {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { recommendations?: unknown }).recommendations)) {
    return false;
  }

  return (value as { recommendations: unknown[] }).recommendations.every((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const candidate = entry as Partial<PlanningRecommendationResponseEntry>;
    return (
      typeof candidate.dayKey === 'string' &&
      isMealSlot(candidate.meal) &&
      Array.isArray(candidate.dishes) &&
      candidate.dishes.every(
        (dish) =>
          dish &&
          typeof dish === 'object' &&
          typeof (dish as Partial<PlanningRecommendationResponseDish>).name === 'string' &&
          typeof (dish as Partial<PlanningRecommendationResponseDish>).isNew === 'boolean'
      ) &&
      typeof candidate.reason === 'string'
    );
  });
}

export function assignPlanningRecommendations(input: {
  mode: PlanningRecommendationMode;
  pendingMeals: PlanningRecommendationInput[];
  dishes: Dish[];
  recommendationCount: number;
  response: PlanningRecommendationResponse;
}) {
  const pendingKeys = new Set(input.pendingMeals.map((slot) => getSlotKey(slot.dayKey, slot.meal)));
  const visibleDishes = getVisibleDishes(input.dishes);
  const ownCatalog = getPlanningCatalogDishes(input.dishes, 'own');
  const mixedCatalog = getPlanningCatalogDishes(input.dishes, 'mix');
  const ownByName = new Map(ownCatalog.map((dish) => [normalizeDishName(dish.name), dish] as const));
  const mixedByName = new Map(mixedCatalog.map((dish) => [normalizeDishName(dish.name), dish] as const));
  const knownNames = new Set(visibleDishes.map((dish) => normalizeDishName(dish.name)));
  const limit = clampRecommendationCount(input.recommendationCount);
  const seenSlots = new Set<string>();

  return input.response.recommendations.flatMap((entry) => {
    const slotKey = getSlotKey(entry.dayKey, entry.meal);
    if (!pendingKeys.has(slotKey) || seenSlots.has(slotKey)) return [];

    const mappedSuggestions = [
      ...new Map(
        entry.dishes
          .map((dish) => mapSuggestedDish(dish, input.mode, ownByName, mixedByName, knownNames))
          .filter((dish): dish is PlanningRecommendationDish => Boolean(dish))
          .map((dish) => [normalizeDishName(dish.name), dish] as const)
      ).values(),
    ];
    const suggestions = getBalancedSuggestions(mappedSuggestions, input.mode, limit);

    if (suggestions.length === 0) return [];
    if (input.mode === 'mix' && !suggestions.some((dish) => dish.isNew)) return [];
    seenSlots.add(slotKey);
    return [{ dayKey: entry.dayKey, meal: entry.meal, dishes: suggestions, reason: entry.reason.trim() }];
  });
}

export function getPlanningCatalogDishes(dishes: Dish[], mode: PlanningRecommendationMode) {
  const visible = getVisibleDishes(dishes);
  if (mode === 'new') return [];
  if (mode === 'own') return visible.filter((dish) => !dish.isGlobal && dish.scope !== 'global');
  return visible;
}

export function hasPlanningCatalogForMode(dishes: Dish[], mode: PlanningRecommendationMode) {
  if (mode === 'new') return true;
  return getPlanningCatalogDishes(dishes, mode).length > 0;
}

function describeCatalog(dishes: Dish[], mode: PlanningRecommendationMode) {
  const visibleCatalog = getPlanningCatalogDishes(dishes, mode);
  if (!visibleCatalog.length) return '- none';

  return visibleCatalog
    .slice(0, maxCatalogDishes)
    .map((dish) => {
      const details = [
        `scope:${dish.scope}`,
        dish.favorite ? 'favorite' : '',
        dish.quickTags?.length ? `tags:${dish.quickTags.join(',')}` : '',
        typeof dish.timesUsed === 'number' ? `timesUsed:${dish.timesUsed}` : '',
      ]
        .filter(Boolean)
        .join(' | ');
      return details ? `- ${dish.name} | ${details}` : `- ${dish.name}`;
    })
    .join('\n');
}

function getVisibleDishes(dishes: Dish[]) {
  return dishes.filter((dish) => !dish.archived && !dish.blocked);
}

function describeFoodIntolerances(foodIntolerances = '') {
  return foodIntolerances.trim().slice(0, maxFoodIntolerancesPromptLength);
}

function describeCurrentMeals(
  days: Record<string, Partial<DailyMenu> | undefined>,
  pendingMeals: PlanningRecommendationInput[],
  mealLabels: Record<MealSlot, string>,
  dailyOptions: DailyOption[] = []
) {
  const dateKeys = [...new Set(pendingMeals.map((slot) => slot.dayKey))].sort();

  return dateKeys
    .flatMap((dayKey) => {
      const day = normalizeDay(days[dayKey]);
      const optionHints = getDailyOptionPromptHints(day, dailyOptions).join(', ');
      const optionText = optionHints ? ` | conditions: ${optionHints}` : '';
      if (day.skipped) return [`- ${dayKey} | whole day skipped${optionText}`];

      return (['breakfast', 'lunch', 'dinner'] as MealSlot[]).flatMap((meal) => {
        const mealState = day.meals[meal];
        if (mealState.skipped) return [`- ${dayKey} | ${mealLabels[meal] ?? meal} | skipped${optionText}`];
        if (mealState.items.length === 0) return [];
        return [`- ${dayKey} | ${mealLabels[meal] ?? meal} | ${mealState.items.join(', ')}${optionText}`];
      });
    })
    .join('\n');
}

function describeDayOptions(
  days: Record<string, Partial<DailyMenu> | undefined>,
  pendingMeals: PlanningRecommendationInput[],
  dailyOptions: DailyOption[]
) {
  const dateKeys = [...new Set(pendingMeals.map((slot) => slot.dayKey))].sort();
  return dateKeys
    .map((dayKey) => {
      const hints = getDailyOptionPromptHints(normalizeDay(days[dayKey]), dailyOptions);
      return hints.length ? `- ${dayKey}: ${hints.join(', ')}` : '';
    })
    .filter(Boolean)
    .join('\n');
}

function getTasteProfile(dishes: Dish[]) {
  return getVisibleDishes(dishes)
    .sort((left, right) => {
      if (Boolean(left.favorite) !== Boolean(right.favorite)) return left.favorite ? -1 : 1;
      return (right.timesUsed ?? 0) - (left.timesUsed ?? 0) || left.name.localeCompare(right.name);
    })
    .slice(0, maxTasteProfileDishes)
    .map((dish) => {
      const bits = [
        dish.name,
        dish.favorite ? 'favorite' : '',
        dish.quickTags?.length ? `tags:${dish.quickTags.join(',')}` : '',
        typeof dish.timesUsed === 'number' ? `timesUsed:${dish.timesUsed}` : '',
      ]
        .filter(Boolean)
        .join(' | ');

      return `- ${bits}`;
    })
    .join('\n');
}

function describeRecentDishes(dishes: Dish[]) {
  return getVisibleDishes(dishes)
    .filter((dish) => dish.lastUsedAt)
    .sort((left, right) => (right.lastUsedAt?.getTime() ?? 0) - (left.lastUsedAt?.getTime() ?? 0))
    .slice(0, maxRecentDishesToAvoid)
    .map((dish) => {
      const date = dish.lastUsedAt ? dish.lastUsedAt.toISOString().slice(0, 10) : '';
      return date ? `- ${dish.name} | lastUsed:${date}` : `- ${dish.name}`;
    })
    .join('\n');
}

function getModeRules(mode: PlanningRecommendationMode, recommendationCount: number) {
  if (mode === 'own') return 'Mode rule: use only exact names from the saved own dishes catalog. Do not invent new dishes and do not use global-only dishes.';
  if (mode === 'new') return 'Mode rule: invent genuinely new dishes only. You must not reuse or rename any saved dish. Every returned dish must be new and absent from known catalog names.';
  return [
    'Mode rule: every mixed-mode recommendation must include at least one genuinely new dish that is absent from known catalog names.',
    'The first dish in every mixed-mode dishes array MUST be a never-saved dish with isNew=true and a name that does not appear in Known dish names already in the catalog.',
    recommendationCount >= 3
      ? 'Also include at least one own/group saved dish and at least one global saved dish when the catalogs contain them.'
      : 'Also include one saved dish when possible.',
    'Do not mark saved catalog dishes as new. Do not return only saved dishes in mixed mode.',
    'If you cannot provide a genuinely new dish for a slot, omit that slot instead of returning only saved dishes.',
    'Use exact saved dish names for catalog dishes and mark only genuinely absent catalog names with isNew=true.',
  ].join(' ');
}

function describeMode(mode: PlanningRecommendationMode) {
  if (mode === 'own') return 'saved own dishes only';
  if (mode === 'new') return 'new dishes only';
  return 'balanced mix with a mandatory genuinely new dish plus saved own/group and global dishes';
}

function mapSuggestedDish(
  dish: PlanningRecommendationResponseDish,
  mode: PlanningRecommendationMode,
  ownByName: Map<string, Dish>,
  mixedByName: Map<string, Dish>,
  knownNames: Set<string>
) {
  const cleanName = cleanDishName(dish.name);
  const normalizedName = normalizeDishName(cleanName);
  if (normalizedName.length < 2) return null;

  const ownMatch = ownByName.get(normalizedName);
  const mixedMatch = mixedByName.get(normalizedName);

  if (mode === 'own') return ownMatch ? mapCatalogDish(ownMatch) : null;
  if (mode === 'new') return dish.isNew === true && !knownNames.has(normalizedName) ? mapNewDish(cleanName) : null;
  if (dish.isNew === true) return knownNames.has(normalizedName) ? null : mapNewDish(cleanName);
  return mixedMatch ? mapCatalogDish(mixedMatch) : null;
}

function getBalancedSuggestions(suggestions: PlanningRecommendationDish[], mode: PlanningRecommendationMode, limit: number) {
  if (mode !== 'mix') return suggestions.slice(0, limit);

  const balanced = [
    suggestions.find((dish) => dish.isNew),
    suggestions.find((dish) => !dish.isNew && !dish.isGlobal && dish.scope !== 'global'),
    suggestions.find((dish) => !dish.isNew && (dish.isGlobal || dish.scope === 'global')),
    ...suggestions,
  ].filter((dish): dish is PlanningRecommendationDish => Boolean(dish));

  return [...new Map(balanced.map((dish) => [normalizeDishName(dish.name), dish] as const)).values()].slice(0, limit);
}

function mapCatalogDish(dish: Dish): PlanningRecommendationDish {
  return { name: dish.name, isNew: false, scope: dish.scope, isGlobal: dish.isGlobal };
}

function mapNewDish(name: string): PlanningRecommendationDish {
  return { name, isNew: true, scope: 'new', isGlobal: false };
}

function clampRecommendationCount(value: number) {
  return Math.max(1, Math.min(maxSuggestedDishes, Math.round(value || 1)));
}

function isMealSlot(value: unknown): value is MealSlot {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner';
}

function getSlotKey(dayKey: string, meal: MealSlot) {
  return `${dayKey}::${meal}`;
}
