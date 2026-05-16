import type { DailyMenu, MealEntry } from './types';

export function emptyMeal(): MealEntry {
  return { items: [], skipped: false, reason: '', note: '' };
}

export function emptyDay(): DailyMenu {
  return {
    meals: {
      breakfast: emptyMeal(),
      lunch: emptyMeal(),
      dinner: emptyMeal(),
    },
    skipped: false,
    reason: '',
    skipNote: '',
    notes: '',
  };
}

export function normalizeMeal(data?: Partial<MealEntry>): MealEntry {
  return {
    ...emptyMeal(),
    ...data,
    items: Array.isArray(data?.items) ? data.items : [],
    skipped: Boolean(data?.skipped),
    reason: data?.reason ?? '',
    note: data?.note ?? '',
  };
}

export function normalizeDay(data: Partial<DailyMenu> = {}): DailyMenu {
  const meals = data.meals ?? {};
  const legacyLunchItems = data.lunchItems ?? (data.lunch ? [data.lunch].filter(Boolean) : []);
  const legacyDinnerItems = data.dinner ? [data.dinner].filter(Boolean) : [];

  return {
    ...emptyDay(),
    ...data,
    meals: {
      breakfast: normalizeMeal(meals.breakfast),
      lunch: normalizeMeal({
        ...(meals.lunch ?? {}),
        items: meals.lunch?.items ?? legacyLunchItems,
        skipped: meals.lunch?.skipped ?? Boolean(data.noLunch),
        reason: meals.lunch?.reason ?? data.noLunchReason ?? '',
        note: meals.lunch?.note ?? data.noLunchDescription ?? '',
      }),
      dinner: normalizeMeal({
        ...(meals.dinner ?? {}),
        items: meals.dinner?.items ?? legacyDinnerItems,
      }),
    },
    skipped: Boolean(data.skipped),
    reason: data.reason ?? '',
    skipNote: data.skipNote ?? '',
    notes: data.notes ?? '',
  };
}
