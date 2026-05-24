const mealSlots = ['breakfast', 'lunch', 'dinner'];
const noMealReasons = new Set(['away', 'eating-out', 'not-hungry', 'other']);

function emptyMeal() {
  return { items: [], skipped: false, reason: '', note: '' };
}

function normalizeString(value) {
  return String(value ?? '').trim();
}

export function normalizeStatisticsText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-ES')
    .trim()
    .replace(/\s+/g, ' ');
}

function normalizeReason(value) {
  return noMealReasons.has(value) ? value : '';
}

function normalizeMeal(value = {}) {
  const items = Array.isArray(value.items) ? value.items.map(normalizeString).filter(Boolean) : [];
  return {
    ...emptyMeal(),
    ...value,
    items,
    skipped: Boolean(value.skipped),
    reason: normalizeReason(value.reason),
    note: normalizeString(value.note),
  };
}

export function normalizeStatisticsDay(value = {}) {
  const meals = value.meals ?? {};
  const legacyLunchItems = value.lunchItems ?? (value.lunch ? [value.lunch].filter(Boolean) : []);
  const legacyDinnerItems = value.dinner ? [value.dinner].filter(Boolean) : [];

  return {
    ...value,
    skipped: Boolean(value.skipped),
    reason: normalizeReason(value.reason),
    skipNote: normalizeString(value.skipNote),
    notes: normalizeString(value.notes),
    meals: {
      breakfast: normalizeMeal(meals.breakfast),
      lunch: normalizeMeal({
        ...(meals.lunch ?? {}),
        items: meals.lunch?.items ?? legacyLunchItems,
        skipped: meals.lunch?.skipped ?? Boolean(value.noLunch),
        reason: meals.lunch?.reason ?? value.noLunchReason ?? '',
        note: meals.lunch?.note ?? value.noLunchDescription ?? '',
      }),
      dinner: normalizeMeal({
        ...(meals.dinner ?? {}),
        items: meals.dinner?.items ?? legacyDinnerItems,
      }),
    },
  };
}

function getDateTime(isoDate) {
  return new Date(`${isoDate}T00:00:00`).getTime() || 0;
}

function formatLocalIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isIsoDateInRange(isoDate, range) {
  if (!isoDate) return false;
  if (range?.start && isoDate < range.start) return false;
  if (range?.end && isoDate > range.end) return false;
  return true;
}

function getWeekStart(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  const day = date.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  return formatLocalIsoDate(date);
}

function getMonthKey(isoDate) {
  return isoDate.slice(0, 7);
}

function incrementMap(map, key, value = 1) {
  if (!key) return;
  map.set(key, (map.get(key) ?? 0) + value);
}

function toDate(value) {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date;
  }
  return value?.toDate?.() ?? undefined;
}

function buildDishIndex(dishes) {
  const index = new Map();
  dishes.forEach((dish) => {
    const key = normalizeStatisticsText(dish.normalizedName || dish.name);
    if (key) index.set(key, dish);
  });
  return index;
}

function getDishMeta(dishIndex, name) {
  return dishIndex.get(normalizeStatisticsText(name)) ?? null;
}

function collectDishTags(items, dishIndex) {
  return [...new Set(items.flatMap((item) => {
    const dish = getDishMeta(dishIndex, item);
    return [...(dish?.tags ?? []), ...(dish?.quickTags ?? [])].map(normalizeString).filter(Boolean);
  }))];
}

function hasLeftoverSignal(items, day, meal, tags) {
  const text = normalizeStatisticsText([items.join(' '), day.notes, day.skipNote, meal.note, tags.join(' ')].join(' '));
  return /\b(tupper|tuppers|sobra|sobras|leftover|leftovers|batch cooking)\b/.test(text);
}

function hasCustomSignal(day, meal) {
  return day.reason === 'other' || meal.reason === 'other' || Boolean(day.notes || day.skipNote || meal.note);
}

function sortStatItems(items) {
  return [...items].sort((first, second) => second.count - first.count || first.name.localeCompare(second.name, 'es', { sensitivity: 'base' }));
}

function mapCountMap(map) {
  return sortStatItems([...map.entries()].map(([name, count]) => ({ name, count })));
}

function mapTemporalCount(map) {
  return [...map.entries()].sort(([first], [second]) => first.localeCompare(second)).map(([period, count]) => ({ period, count }));
}

function getLastUsedTime(dish) {
  const date = toDate(dish.lastUsedAt);
  return date?.getTime?.() ?? 0;
}

function getDishDateIso(dish) {
  const date = toDate(dish.lastUsedAt);
  return date ? formatLocalIsoDate(date) : '';
}

function buildStaleDishes(dishes, limit) {
  return dishes
    .filter((dish) => !dish.archived && !dish.blocked && !dish.isGlobal)
    .sort((first, second) => getLastUsedTime(first) - getLastUsedTime(second) || first.name.localeCompare(second.name, 'es', { sensitivity: 'base' }))
    .slice(0, limit)
    .map((dish) => ({ name: dish.name, count: dish.timesUsed ?? 0, lastUsed: getDishDateIso(dish) }));
}

export function buildMenuStatistics(menus, dishes, enabledMeals = ['lunch'], options = {}) {
  const range = options.range ?? {};
  const limit = options.limit ?? 6;
  const safeMeals = enabledMeals.filter((meal) => mealSlots.includes(meal));
  const activeMeals = safeMeals.length ? safeMeals : ['lunch'];
  const dishIndex = buildDishIndex(dishes);
  const dishCounts = new Map();
  const favoriteCounts = new Map();
  const tagCounts = new Map();
  const weekCounts = new Map();
  const monthCounts = new Map();
  const dayCustomFlags = new Set();
  let totalMealSlots = 0;
  let plannedMeals = 0;
  let skippedMeals = 0;
  let eatingOutMeals = 0;
  let unplannedMeals = 0;
  let leftoversMeals = 0;

  menus.forEach((menu) => {
    Object.entries(menu.days ?? {}).forEach(([isoDate, rawDay]) => {
      if (!isIsoDateInRange(isoDate, range)) return;
      const day = normalizeStatisticsDay(rawDay);

      activeMeals.forEach((mealSlot) => {
        const meal = day.meals[mealSlot] ?? emptyMeal();
        const items = day.skipped ? [] : meal.items.filter(Boolean);
        const skipped = day.skipped || meal.skipped;
        const eatingOut = day.reason === 'eating-out' || meal.reason === 'eating-out';
        const custom = hasCustomSignal(day, meal);
        const tags = collectDishTags(items, dishIndex);
        totalMealSlots += 1;

        if (skipped) skippedMeals += 1;
        if (eatingOut) eatingOutMeals += 1;
        if (custom) dayCustomFlags.add(isoDate);

        if (!items.length) {
          if (!skipped) unplannedMeals += 1;
          return;
        }

        plannedMeals += 1;
        incrementMap(weekCounts, getWeekStart(isoDate));
        incrementMap(monthCounts, getMonthKey(isoDate));

        if (hasLeftoverSignal(items, day, meal, tags)) leftoversMeals += 1;
        tags.forEach((tag) => incrementMap(tagCounts, tag));
        items.forEach((item) => {
          const key = normalizeStatisticsText(item);
          if (!key) return;
          const dish = getDishMeta(dishIndex, item);
          const label = dish?.name || item;
          incrementMap(dishCounts, label);
          if (dish?.favorite) incrementMap(favoriteCounts, label);
        });
      });
    });
  });

  const topDishes = mapCountMap(dishCounts);
  const favoriteDishes = mapCountMap(favoriteCounts);
  const varietyTags = mapCountMap(tagCounts);
  const completionRate = totalMealSlots > 0 ? Math.round((plannedMeals / totalMealSlots) * 100) : 0;

  return {
    range,
    totalMealSlots,
    plannedMeals,
    skippedMeals,
    eatingOutMeals,
    unplannedMeals,
    leftoversMeals,
    customDays: dayCustomFlags.size,
    completionRate,
    topDishes: topDishes.slice(0, limit),
    favoriteDishes: favoriteDishes.slice(0, limit),
    staleDishes: buildStaleDishes(dishes, limit),
    varietyTags: varietyTags.slice(0, limit),
    mealsByWeek: mapTemporalCount(weekCounts),
    mealsByMonth: mapTemporalCount(monthCounts),
  };
}

export function hasEnoughStatisticsData(stats) {
  return Boolean(stats?.totalMealSlots > 0 && (stats.plannedMeals > 0 || stats.skippedMeals > 0 || stats.unplannedMeals > 0));
}

export function getStatisticsRangePreset(days, now = new Date()) {
  const end = new Date(now);
  end.setHours(0, 0, 0, 0);
  const start = new Date(end);
  start.setDate(start.getDate() - Math.max(1, days) + 1);
  return { start: formatLocalIsoDate(start), end: formatLocalIsoDate(end) };
}
