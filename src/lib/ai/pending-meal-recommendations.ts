import { normalizeDishName } from '../dishes/helpers.mjs';
import { normalizeDay } from '../menu/normalizers.ts';
import type { DailyMenu, Dish, MealSlot } from '../menu/types.ts';

const maxPendingMeals = 21;
const maxCatalogDishes = 48;
const maxRecommendedDishes = 3;

export type PendingMealSlot = {
  dayKey: string;
  meal: MealSlot;
};

export type PendingMealRecommendation = {
  dayKey: string;
  meal: MealSlot;
  dishes: string[];
  reason: string;
};

export type PendingMealRecommendationResponse = {
  recommendations: PendingMealRecommendation[];
};

export function getPendingMealSlots(
  days: Record<string, Partial<DailyMenu> | undefined>,
  dayKeys: string[],
  enabledMeals: MealSlot[]
) {
  return dayKeys
    .flatMap((dayKey) => {
      const day = normalizeDay(days[dayKey]);
      if (day.skipped) {
        return [];
      }

      return enabledMeals.flatMap((meal) => {
        const mealState = day.meals[meal];
        const hasItems = mealState.items.some((item) => item.trim().length > 0);
        if (mealState.skipped || hasItems) {
          return [];
        }

        return [{ dayKey, meal } satisfies PendingMealSlot];
      });
    })
    .slice(0, maxPendingMeals);
}

export function buildPendingMealPrompt(input: {
  locale: string;
  pendingMeals: PendingMealSlot[];
  dishes: Dish[];
  mealLabels: Record<MealSlot, string>;
}) {
  const pendingMeals = input.pendingMeals
    .slice(0, maxPendingMeals)
    .map((slot) => `- ${slot.dayKey} | ${slot.meal} | ${input.mealLabels[slot.meal] ?? slot.meal}`)
    .join('\n');
  const catalog = input.dishes
    .filter((dish) => !dish.archived && !dish.blocked)
    .slice(0, maxCatalogDishes)
    .map((dish) => {
      const details = [
        dish.favorite ? 'favorite' : '',
        dish.quickTags?.length ? `tags:${dish.quickTags.join(',')}` : '',
        typeof dish.timesUsed === 'number' ? `timesUsed:${dish.timesUsed}` : '',
      ]
        .filter(Boolean)
        .join(' | ');

      return details ? `- ${dish.name} | ${details}` : `- ${dish.name}`;
    })
    .join('\n');

  return [
    `Locale: ${input.locale}.`,
    'Task: suggest dishes only for pending meals in a weekly menu app.',
    'Use only dish names from the provided catalog. Do not invent new dishes.',
    'Keep recommendations practical, varied and concise. Avoid private data.',
    `Return JSON with shape {"recommendations":[{"dayKey":"YYYY-MM-DD","meal":"breakfast|lunch|dinner","dishes":["Dish"],"reason":"short string"}]}.`,
    `Each recommendation must target one pending slot. Return up to ${maxRecommendedDishes} dishes per slot.`,
    'Pending meals:',
    pendingMeals,
    'Visible dish catalog:',
    catalog,
  ].join('\n\n');
}

export function isPendingMealRecommendationResponse(value: unknown): value is PendingMealRecommendationResponse {
  if (!value || typeof value !== 'object' || !Array.isArray((value as { recommendations?: unknown }).recommendations)) {
    return false;
  }

  return (value as { recommendations: unknown[] }).recommendations.every((entry) => {
    if (!entry || typeof entry !== 'object') {
      return false;
    }

    const candidate = entry as Partial<PendingMealRecommendation>;
    return (
      typeof candidate.dayKey === 'string' &&
      isMealSlot(candidate.meal) &&
      Array.isArray(candidate.dishes) &&
      candidate.dishes.every((dish) => typeof dish === 'string') &&
      typeof candidate.reason === 'string'
    );
  });
}

export function assignPendingMealRecommendations(input: {
  pendingMeals: PendingMealSlot[];
  dishes: Dish[];
  response: PendingMealRecommendationResponse;
}) {
  const pendingKeys = new Set(input.pendingMeals.map((slot) => getSlotKey(slot.dayKey, slot.meal)));
  const catalogByName = new Map(
    input.dishes
      .filter((dish) => !dish.archived && !dish.blocked)
      .map((dish) => [normalizeDishName(dish.name), dish.name] as const)
  );
  const seenSlots = new Set<string>();

  return input.response.recommendations.flatMap((entry) => {
    const slotKey = getSlotKey(entry.dayKey, entry.meal);
    if (!pendingKeys.has(slotKey) || seenSlots.has(slotKey)) {
      return [];
    }

    const dishes = [...new Set(entry.dishes.map((dish) => catalogByName.get(normalizeDishName(dish)) ?? '').filter(Boolean))]
      .slice(0, maxRecommendedDishes);
    if (dishes.length === 0) {
      return [];
    }

    seenSlots.add(slotKey);
    return [
      {
        dayKey: entry.dayKey,
        meal: entry.meal,
        dishes,
        reason: entry.reason.trim(),
      } satisfies PendingMealRecommendation,
    ];
  });
}

function isMealSlot(value: unknown): value is MealSlot {
  return value === 'breakfast' || value === 'lunch' || value === 'dinner';
}

function getSlotKey(dayKey: string, meal: MealSlot) {
  return `${dayKey}::${meal}`;
}
