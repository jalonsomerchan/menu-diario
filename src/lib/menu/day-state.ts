import { getAddedDishNamesFromItems } from './dish-usage.mjs';
import { normalizeDay } from './normalizers.ts';
import type { DailyMenu, MealSlot } from './types.ts';

const mealSlots: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

function stableDay(day: Partial<DailyMenu>) {
  const normalized = normalizeDay(day);
  return {
    skipped: normalized.skipped,
    reason: normalized.reason ?? '',
    skipNote: normalized.skipNote ?? '',
    notes: normalized.notes ?? '',
    meals: Object.fromEntries(
      mealSlots.map((meal) => [
        meal,
        {
          skipped: normalized.meals[meal].skipped,
          reason: normalized.meals[meal].reason,
          note: normalized.meals[meal].note,
          items: [...normalized.meals[meal].items],
          participantIds: normalized.meals[meal].participantIds ? [...normalized.meals[meal].participantIds] : undefined,
        },
      ])
    ),
  };
}

export function serializeDay(day: Partial<DailyMenu>) {
  return JSON.stringify(stableDay(day));
}

export function isSameDayMenu(left: Partial<DailyMenu>, right: Partial<DailyMenu>) {
  return serializeDay(left) === serializeDay(right);
}

export function getAddedDishNames(previousDay: Partial<DailyMenu>, nextDay: Partial<DailyMenu>) {
  const previous = normalizeDay(previousDay);
  const next = normalizeDay(nextDay);
  return mealSlots.flatMap((meal) => getAddedDishNamesFromItems(previous.meals[meal].items, next.meals[meal].items));
}
