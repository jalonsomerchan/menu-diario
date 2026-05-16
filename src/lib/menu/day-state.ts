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
  const additions: string[] = [];

  mealSlots.forEach((meal) => {
    const previousCounts = new Map<string, number>();
    previous.meals[meal].items.forEach((item) => {
      previousCounts.set(item, (previousCounts.get(item) ?? 0) + 1);
    });

    next.meals[meal].items.forEach((item) => {
      const remaining = previousCounts.get(item) ?? 0;
      if (remaining > 0) {
        previousCounts.set(item, remaining - 1);
        return;
      }
      additions.push(item);
    });
  });

  return additions;
}
