import { normalizeDay } from './normalizers.ts';
import type { DailyMenu, Dish, MealSlot, WeekMenu } from './types.ts';

const mealSlots: MealSlot[] = ['breakfast', 'lunch', 'dinner'];

export type HistoryStatusFilter = 'all' | 'planned' | 'skipped' | 'empty';
export type HistorySpecialFilter = 'all' | 'favorite' | 'leftovers' | 'eating-out' | 'unplanned' | 'custom';
export type HistorySortMode = 'date-desc' | 'date-asc' | 'dish' | 'frequency';

export type HistoryFilters = {
  query: string;
  status: HistoryStatusFilter;
  weekday: string;
  meal?: 'all' | MealSlot;
  dish?: string;
  tag?: string;
  special?: HistorySpecialFilter;
  sort?: HistorySortMode;
};

export type HistoryRow = {
  id: string;
  menuId: string;
  isoDate: string;
  meal: MealSlot;
  items: string[];
  tags: string[];
  isFavorite: boolean;
  hasLeftovers: boolean;
  dayStatus: ReturnType<typeof getHistoryDayStatus>;
  state: 'planned' | 'skipped' | 'unplanned' | 'eating-out' | 'custom';
  daySkipped: boolean;
  mealSkipped: boolean;
  dayReason: string;
  mealReason: string;
  dayNotes: string;
  mealNote: string;
};

export function normalizeHistoryText(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-ES')
    .trim()
    .replace(/\s+/g, ' ');
}

function dateValue(isoDate: string) {
  return new Date(`${isoDate}T00:00:00`).getTime() || 0;
}

function byName(first: string, second: string) {
  return first.localeCompare(second, 'es', { sensitivity: 'base' });
}

function buildDishIndex(dishes: Dish[]) {
  const index = new Map<string, Dish>();
  dishes.forEach((dish) => {
    const key = normalizeHistoryText(dish.normalizedName || dish.name);
    if (key) index.set(key, dish);
  });
  return index;
}

function findDishMeta(dishIndex: Map<string, Dish>, dishName: string) {
  return dishIndex.get(normalizeHistoryText(dishName)) ?? null;
}

function collectTags(items: string[], dishIndex: Map<string, Dish>) {
  return [...new Set(items.flatMap((item) => {
    const dish = findDishMeta(dishIndex, item);
    return [...(dish?.tags ?? []), ...(dish?.quickTags ?? [])].filter(Boolean);
  }))];
}

function hasFavorite(items: string[], dishIndex: Map<string, Dish>) {
  return items.some((item) => Boolean(findDishMeta(dishIndex, item)?.favorite));
}

function rowDishName(row: HistoryRow) {
  return row.items[0] || '~~~~';
}

function hasLeftoverSignal(row: Pick<HistoryRow, 'items' | 'dayNotes' | 'mealNote'>, tags: string[]) {
  const text = normalizeHistoryText([row.items.join(' '), row.dayNotes, row.mealNote, tags.join(' ')].join(' '));
  return /\b(tupper|tuppers|sobra|sobras|leftover|leftovers|batch cooking)\b/.test(text);
}

function getRowState(row: Pick<HistoryRow, 'dayReason' | 'mealReason' | 'daySkipped' | 'mealSkipped' | 'items' | 'dayNotes' | 'mealNote'>): HistoryRow['state'] {
  if (row.dayReason === 'eating-out' || row.mealReason === 'eating-out') return 'eating-out';
  if (row.daySkipped || row.mealSkipped) return 'skipped';
  if (row.items.length === 0) return 'unplanned';
  if (row.dayReason === 'other' || row.mealReason === 'other' || row.dayNotes || row.mealNote) return 'custom';
  return 'planned';
}

function getRowFrequency(row: HistoryRow, frequencyMap: Map<string, number>) {
  return Math.max(0, ...row.items.map((item) => frequencyMap.get(normalizeHistoryText(item)) ?? 0));
}

function buildFrequencyMap(rows: HistoryRow[]) {
  const frequencies = new Map<string, number>();
  rows.forEach((row) => {
    row.items.forEach((item) => {
      const key = normalizeHistoryText(item);
      if (key) frequencies.set(key, (frequencies.get(key) ?? 0) + 1);
    });
  });
  return frequencies;
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
  return buildHistoryRows([{ id: '', days: { [isoDate]: day } } as WeekMenu], [], enabledMeals, filters).length > 0;
}

export function buildHistoryRows(menus: WeekMenu[], dishes: Dish[], enabledMeals: MealSlot[], filters: HistoryFilters) {
  const dishIndex = buildDishIndex(dishes);
  const selectedMeal = mealSlots.includes(filters.meal as MealSlot) ? filters.meal as MealSlot : 'all';
  const meals = selectedMeal === 'all' ? enabledMeals : [selectedMeal];
  const query = normalizeHistoryText(filters.query);
  const dishQuery = normalizeHistoryText(filters.dish);
  const tagQuery = normalizeHistoryText(filters.tag);
  const rows: HistoryRow[] = [];

  menus.forEach((menu) => {
    Object.entries(menu.days ?? {}).forEach(([isoDate, rawDay]) => {
      if (filters.weekday !== 'all' && getHistoryWeekdayValue(isoDate) !== filters.weekday) return;
      const day = normalizeDay(rawDay);
      const dayStatus = getHistoryDayStatus(day, enabledMeals);
      if (filters.status !== 'all' && filters.status !== dayStatus) return;

      meals.forEach((mealSlot) => {
        const meal = day.meals[mealSlot];
        const items = day.skipped ? [] : meal.items.filter(Boolean);
        const tags = collectTags(items, dishIndex);
        const row = {
          id: `${menu.id}-${isoDate}-${mealSlot}`,
          menuId: menu.id,
          isoDate,
          meal: mealSlot,
          items,
          tags,
          isFavorite: hasFavorite(items, dishIndex),
          hasLeftovers: false,
          dayStatus,
          state: 'planned' as HistoryRow['state'],
          daySkipped: day.skipped,
          mealSkipped: meal.skipped,
          dayReason: day.reason ?? '',
          mealReason: meal.reason ?? '',
          dayNotes: day.notes || day.skipNote || '',
          mealNote: meal.note || '',
        } satisfies HistoryRow;
        row.state = getRowState(row);
        row.hasLeftovers = hasLeftoverSignal(row, tags);

        const haystack = normalizeHistoryText([
          isoDate,
          mealSlot,
          items.join(' '),
          tags.join(' '),
          row.state,
          row.dayNotes,
          row.mealNote,
        ].join(' '));

        if (query && !haystack.includes(query)) return;
        if (dishQuery && !normalizeHistoryText(items.join(' ')).includes(dishQuery)) return;
        if (tagQuery && !tags.some((tag) => normalizeHistoryText(tag).includes(tagQuery))) return;
        if (filters.special === 'favorite' && !row.isFavorite) return;
        if (filters.special === 'leftovers' && !row.hasLeftovers) return;
        if (filters.special === 'eating-out' && row.state !== 'eating-out') return;
        if (filters.special === 'unplanned' && row.state !== 'unplanned') return;
        if (filters.special === 'custom' && row.state !== 'custom') return;

        rows.push(row);
      });
    });
  });

  return rows;
}

export function sortHistoryRows(rows: HistoryRow[], mode: HistorySortMode = 'date-desc') {
  const frequencyMap = mode === 'frequency' ? buildFrequencyMap(rows) : new Map<string, number>();
  return [...rows].sort((first, second) => {
    if (mode === 'date-asc') return dateValue(first.isoDate) - dateValue(second.isoDate) || byName(rowDishName(first), rowDishName(second));
    if (mode === 'dish') return byName(rowDishName(first), rowDishName(second)) || dateValue(second.isoDate) - dateValue(first.isoDate);
    if (mode === 'frequency') return getRowFrequency(second, frequencyMap) - getRowFrequency(first, frequencyMap) || dateValue(second.isoDate) - dateValue(first.isoDate) || byName(rowDishName(first), rowDishName(second));
    return dateValue(second.isoDate) - dateValue(first.isoDate) || byName(first.meal, second.meal);
  });
}

export function filterAndSortHistoryRows(menus: WeekMenu[], dishes: Dish[], enabledMeals: MealSlot[], filters: HistoryFilters) {
  return sortHistoryRows(buildHistoryRows(menus, dishes, enabledMeals, filters), filters.sort);
}

export function countActiveHistoryFilters(filters: HistoryFilters) {
  return ['query', 'dish', 'tag'].filter((key) => normalizeHistoryText(filters[key as keyof HistoryFilters])).length +
    (filters.status && filters.status !== 'all' ? 1 : 0) +
    (filters.weekday && filters.weekday !== 'all' ? 1 : 0) +
    (filters.meal && filters.meal !== 'all' ? 1 : 0) +
    (filters.special && filters.special !== 'all' ? 1 : 0) +
    (filters.sort && filters.sort !== 'date-desc' ? 1 : 0);
}
