import { normalizeMeal } from '../menu/normalizers';
import type { MealEntry, MealSlot, WeekMenu } from '../menu/types';
import type { TupperItem } from './types';

export type TupperAssignmentResult = {
  canAssign: boolean;
  nextItems: string[];
  reason?: 'meal-has-items' | 'meal-skipped' | 'day-skipped' | 'already-in-meal';
};

export function buildTupperMenuLabel(tupper: Pick<TupperItem, 'name'>) {
  return `Tupper: ${tupper.name}`;
}

export function getMealForAssignment(menu: WeekMenu, dayKey: string, meal: MealSlot): MealEntry {
  return normalizeMeal(menu.days[dayKey]?.meals?.[meal]);
}

export function planTupperAssignment(
  menu: WeekMenu,
  dayKey: string,
  meal: MealSlot,
  tupper: Pick<TupperItem, 'name'>,
  options: { allowAppend?: boolean } = {}
): TupperAssignmentResult {
  const day = menu.days[dayKey];
  if (day?.skipped) {
    return { canAssign: false, nextItems: [], reason: 'day-skipped' };
  }

  const currentMeal = getMealForAssignment(menu, dayKey, meal);
  if (currentMeal.skipped) {
    return { canAssign: false, nextItems: currentMeal.items, reason: 'meal-skipped' };
  }

  const label = buildTupperMenuLabel(tupper);
  if (currentMeal.items.includes(label)) {
    return { canAssign: false, nextItems: currentMeal.items, reason: 'already-in-meal' };
  }

  if (currentMeal.items.length > 0 && !options.allowAppend) {
    return { canAssign: false, nextItems: currentMeal.items, reason: 'meal-has-items' };
  }

  return { canAssign: true, nextItems: [...currentMeal.items, label] };
}

export function removeTupperFromMealItems(items: string[], tupper: Pick<TupperItem, 'name'>) {
  const label = buildTupperMenuLabel(tupper);
  const index = items.indexOf(label);

  if (index === -1) {
    return items;
  }

  return items.filter((_, itemIndex) => itemIndex !== index);
}
