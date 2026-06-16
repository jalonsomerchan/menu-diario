import type { MealSlot } from './types';
import { isMealSlot, type MealDragSource } from './meal-drag-and-drop';

export function getVisibleDayKeys(container: ParentNode) {
  return [
    ...new Set(
      Array.from(container.querySelectorAll<HTMLElement>('[data-day]'))
        .map((card) => card.dataset.day)
        .filter((dayKey): dayKey is string => Boolean(dayKey))
    ),
  ];
}

export function getSourceFromRow(row: HTMLElement | null): MealDragSource | null {
  const dayKey = row?.closest<HTMLElement>('[data-day]')?.dataset.day;
  const meal = row?.dataset.dragMeal;
  if (!dayKey || !isMealSlot(meal)) return null;

  return { dayKey, meal };
}

export function getDayKeyFromTarget(target: EventTarget | null) {
  return target instanceof HTMLElement ? target.closest<HTMLElement>('[data-day]')?.dataset.day ?? '' : '';
}

export function findDayCard(container: ParentNode, dayKey: string) {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-day]')).find((card) => card.dataset.day === dayKey) ?? null;
}

export function prepareMealRows(container: ParentNode, enabledMeals: MealSlot[], actionLabel: string) {
  container.querySelectorAll<HTMLElement>('[data-day]').forEach((card) => {
    card.querySelectorAll<HTMLElement>('.day-meal-row').forEach((row, index) => {
      const meal = enabledMeals[index];
      if (!meal) return;

      row.dataset.dragMeal = meal;
      row.draggable = true;
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', row.textContent?.trim().replace(/\s+/g, ' ') ?? actionLabel);
    });
  });
}

export function clearDropTarget(container: ParentNode, dayKey: string) {
  if (!dayKey) return '';
  findDayCard(container, dayKey)?.classList.remove('history-card--meal-drop-target');
  return '';
}

export function updateDropTarget(container: ParentNode, currentDayKey: string, nextDayKey: string, source: MealDragSource | null) {
  if (!nextDayKey || source?.dayKey === nextDayKey) return clearDropTarget(container, currentDayKey);
  if (currentDayKey === nextDayKey) return currentDayKey;

  clearDropTarget(container, currentDayKey);
  findDayCard(container, nextDayKey)?.classList.add('history-card--meal-drop-target');
  return nextDayKey;
}

export function clearMealMoveClasses(container: ParentNode) {
  container.querySelectorAll('.day-meal-row--dragging, .day-meal-row--keyboard-source').forEach((row) => {
    row.classList.remove('day-meal-row--dragging', 'day-meal-row--keyboard-source');
  });
}
