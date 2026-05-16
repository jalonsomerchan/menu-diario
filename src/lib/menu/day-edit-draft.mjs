import { normalizeDay } from './normalizers.ts';

// Preserve hidden content when switching the full-day skipped mode so the user
// can move back and forth inside the modal without losing plates or notes.
export function setDaySkippedDraft(day, skipped) {
  return normalizeDay({
    ...normalizeDay(day),
    skipped,
  });
}

export function applyRecommendedMealDraft(day, meal, dishes) {
  const currentDay = normalizeDay(day);
  return normalizeDay({
    ...currentDay,
    skipped: false,
    reason: currentDay.reason ?? '',
    skipNote: currentDay.skipNote ?? '',
    meals: {
      ...currentDay.meals,
      [meal]: {
        ...currentDay.meals[meal],
        skipped: false,
        reason: '',
        note: '',
        items: dishes,
      },
    },
  });
}

export function appendRecommendedMealDraft(day, meal, dish) {
  const currentDay = normalizeDay(day);
  const currentItems = currentDay.meals[meal].items.filter(Boolean);
  const nextItems = currentItems.includes(dish) ? currentItems : [...currentItems, dish];

  return normalizeDay({
    ...currentDay,
    skipped: false,
    reason: currentDay.reason ?? '',
    skipNote: currentDay.skipNote ?? '',
    meals: {
      ...currentDay.meals,
      [meal]: {
        ...currentDay.meals[meal],
        skipped: false,
        reason: '',
        note: '',
        items: nextItems,
      },
    },
  });
}
