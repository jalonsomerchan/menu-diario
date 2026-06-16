import { normalizeDishName } from './helpers.mjs';
import { normalizeDay } from '../menu/normalizers';
import type { MealSlot, WeekMenu } from '../menu/types';

const mealSlots: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

export type DishUsageHistoryEntry = {
  dayKey: string;
  meal: MealSlot;
  dishName: string;
  menuTitle: string;
};

function cleanDishName(value: string) {
  return value.replace(/^tupper:\s*/i, '').trim();
}

export function buildDishUsageHistory(menus: WeekMenu[], dishName: string, limit = 24): DishUsageHistoryEntry[] {
  const targetName = normalizeDishName(cleanDishName(dishName));
  if (!targetName) return [];

  return menus
    .flatMap((menu) =>
      Object.entries(menu.days).flatMap(([dayKey, rawDay]) => {
        const day = normalizeDay(rawDay);
        if (day.skipped) return [];

        return mealSlots.flatMap((meal) => {
          const mealState = day.meals[meal];
          if (mealState.skipped) return [];

          return mealState.items
            .map(cleanDishName)
            .filter((item) => normalizeDishName(item) === targetName)
            .map((item) => ({
              dayKey,
              meal,
              dishName: item,
              menuTitle: menu.title || menu.weekStart,
            }));
        });
      })
    )
    .sort((left, right) => right.dayKey.localeCompare(left.dayKey))
    .slice(0, limit);
}
