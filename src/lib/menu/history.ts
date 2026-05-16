import { normalizeDay } from './normalizers.ts';
import type { DailyMenu, MealSlot } from './types.ts';

export type HistoryStatusFilter = 'all' | 'planned' | 'skipped' | 'empty';

export type HistoryFilters = {
  query: string;
  status: HistoryStatusFilter;
  weekday: string;
};

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-ES')
    .trim();
}

export function getHistoryWeekdayValue(isoDate: string) {
  const date = new Date(`${isoDate}T00:00:00`);
  const weekday = date.getDay();
  return String(weekday === 0 ? 7 : weekday);
}

export function getHistoryDayStatus(day: Partial<DailyMenu> | undefined, enabledMeals: MealSlot[]) {
  const normalizedDay = normalizeDay(day);

  if (normalizedDay.skipped) {
    return 'skipped';
  }

  const hasConfiguredMeal = enabledMeals.some((meal) => {
    const entry = normalizedDay.meals[meal];
    return entry.skipped || entry.items.some(Boolean);
  });

  return hasConfiguredMeal ? 'planned' : 'empty';
}

export function matchesHistoryFilters(
  isoDate: string,
  day: Partial<DailyMenu> | undefined,
  enabledMeals: MealSlot[],
  filters: HistoryFilters
) {
  if (filters.weekday !== 'all' && getHistoryWeekdayValue(isoDate) !== filters.weekday) {
    return false;
  }

  const status = getHistoryDayStatus(day, enabledMeals);
  if (filters.status !== 'all' && filters.status !== status) {
    return false;
  }

  const query = normalizeText(filters.query);
  if (!query) {
    return true;
  }

  const normalizedDay = normalizeDay(day);
  const searchable = [
    isoDate,
    normalizedDay.notes,
    normalizedDay.reason,
    normalizedDay.skipNote,
    ...enabledMeals.flatMap((meal) => {
      const entry = normalizedDay.meals[meal];
      return [meal, entry.reason, entry.note, ...entry.items];
    }),
  ]
    .filter(Boolean)
    .map((value) => normalizeText(String(value)))
    .join(' ');

  return searchable.includes(query);
}
