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
    optionIds: [],
  };
}

function normalizeParticipantIds(value: unknown) {
  if (!Array.isArray(value)) return undefined;
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.trim()).map((id) => id.trim()))];
}

function normalizeOptionIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((id): id is string => typeof id === 'string' && id.trim()).map((id) => id.trim()))];
}

export function normalizeMeal(data?: Partial<MealEntry>): MealEntry {
  const meal = {
    ...emptyMeal(),
    ...data,
    items: Array.isArray(data?.items) ? data.items : [],
    skipped: Boolean(data?.skipped),
    reason: data?.reason ?? '',
    note: data?.note ?? '',
  };
  const participantIds = normalizeParticipantIds(data?.participantIds);

  if (participantIds === undefined) {
    delete meal.participantIds;
    return meal;
  }

  return { ...meal, participantIds };
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
    optionIds: normalizeOptionIds(data.optionIds),
  };
}
