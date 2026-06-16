import { emptyMeal, normalizeDay, normalizeMeal } from './normalizers';
import type { DailyMenu, MealEntry, MealSlot } from './types';

export type MealDragSource = {
  dayKey: string;
  meal: MealSlot;
};

export const mealSlots: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

export function isMealSlot(value: string | undefined): value is MealSlot {
  return mealSlots.includes(value as MealSlot);
}

export function cloneMeal(meal: Partial<MealEntry> | undefined): MealEntry {
  const normalized = normalizeMeal(meal);
  const copy: MealEntry = {
    ...normalized,
    items: [...normalized.items],
  };

  if (normalized.participantIds?.length) {
    copy.participantIds = [...normalized.participantIds];
  } else {
    delete copy.participantIds;
  }

  return copy;
}

export function isEmptyMeal(meal: MealEntry) {
  return !meal.skipped && meal.items.filter(Boolean).length === 0 && !meal.note.trim() && !meal.participantIds?.length;
}

export function canMoveMeal(source: MealDragSource, sourceDay: DailyMenu) {
  return !sourceDay.skipped && !isEmptyMeal(cloneMeal(sourceDay.meals[source.meal]));
}

export function createMovedMealDays(source: MealDragSource, sourceDay: DailyMenu, targetDay: DailyMenu) {
  const sourceMeal = cloneMeal(sourceDay.meals[source.meal]);
  const targetMeal = cloneMeal(targetDay.meals[source.meal] ?? emptyMeal());

  return {
    sourceDay: normalizeDay({
      ...sourceDay,
      meals: {
        ...sourceDay.meals,
        [source.meal]: targetMeal,
      },
    }),
    targetDay: normalizeDay({
      ...targetDay,
      skipped: false,
      reason: '',
      skipNote: '',
      meals: {
        ...targetDay.meals,
        [source.meal]: sourceMeal,
      },
    }),
  };
}
