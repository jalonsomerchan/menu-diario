const mealSlots = ['breakfast', 'lunch', 'dinner'];
const staleDishDays = 21;

function toTime(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') return new Date(value).getTime() || 0;
  return value.toDate?.()?.getTime?.() ?? 0;
}

function normalizeName(value = '') {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es-ES');
}

function dayEntries(menu) {
  return Object.entries(menu?.days ?? {}).sort(([a], [b]) => a.localeCompare(b));
}

function isEatingOut(reason) {
  return reason === 'eating-out' || reason === 'away';
}

function getMeal(day, meal) {
  return day?.meals?.[meal] ?? { items: [], skipped: false, reason: '', note: '' };
}

export function getComparableWeekMenus(menus = [], currentWeekStart) {
  return [...menus]
    .filter((menu) => menu?.weekStart && menu.weekStart < currentWeekStart)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart));
}

export function summarizeWeek(menu, enabledMeals = ['lunch']) {
  const dishCounts = new Map();
  let emptyMeals = 0;
  let eatingOutMeals = 0;
  let plannedMeals = 0;
  let totalMeals = 0;

  dayEntries(menu).forEach(([, day]) => {
    enabledMeals.forEach((meal) => {
      totalMeals += 1;
      const entry = getMeal(day, meal);
      if (day?.skipped || entry.skipped) {
        if (isEatingOut(day?.reason) || isEatingOut(entry.reason)) eatingOutMeals += 1;
        return;
      }

      const items = Array.isArray(entry.items) ? entry.items.map((item) => item.trim()).filter(Boolean) : [];
      if (!items.length) {
        emptyMeals += 1;
        return;
      }

      plannedMeals += 1;
      items.forEach((item) => {
        const key = normalizeName(item);
        const previous = dishCounts.get(key) ?? { name: item, count: 0 };
        dishCounts.set(key, { name: previous.name, count: previous.count + 1 });
      });
    });
  });

  const usedDishes = [...dishCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return {
    weekStart: menu?.weekStart ?? '',
    totalMeals,
    plannedMeals,
    emptyMeals,
    eatingOutMeals,
    usedDishes,
    repeatedDishes: usedDishes.filter((dish) => dish.count > 1),
  };
}

export function getTopUsedDishes(menus = [], enabledMeals = mealSlots, limit = 5) {
  const dishCounts = new Map();

  menus.forEach((menu) => {
    summarizeWeek(menu, enabledMeals).usedDishes.forEach((dish) => {
      const key = normalizeName(dish.name);
      const previous = dishCounts.get(key) ?? { name: dish.name, count: 0 };
      dishCounts.set(key, { name: previous.name, count: previous.count + dish.count });
    });
  });

  return [...dishCounts.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, limit);
}

export function compareWeekWithHistory(currentSummary, previousMenus = [], enabledMeals = ['lunch']) {
  const previousSummaries = previousMenus.map((menu) => summarizeWeek(menu, enabledMeals)).filter((summary) => summary.totalMeals > 0);
  if (!previousSummaries.length) {
    return { hasHistory: false, plannedDelta: 0, emptyDelta: 0, eatingOutDelta: 0 };
  }

  const average = (field) => previousSummaries.reduce((total, summary) => total + summary[field], 0) / previousSummaries.length;

  return {
    hasHistory: true,
    weeksCompared: previousSummaries.length,
    plannedDelta: Math.round(currentSummary.plannedMeals - average('plannedMeals')),
    emptyDelta: Math.round(currentSummary.emptyMeals - average('emptyMeals')),
    eatingOutDelta: Math.round(currentSummary.eatingOutMeals - average('eatingOutMeals')),
  };
}

export function getLatestAddedDish(dishes = []) {
  return [...dishes]
    .filter((dish) => dish?.name && !dish.archived)
    .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt))[0] ?? null;
}

export function getStaleDishRecommendation(dishes = [], now = new Date()) {
  const threshold = now.getTime() - staleDishDays * 24 * 60 * 60 * 1000;
  return [...dishes]
    .filter((dish) => dish?.name && !dish.archived && toTime(dish.lastUsedAt) > 0 && toTime(dish.lastUsedAt) < threshold)
    .sort((a, b) => toTime(a.lastUsedAt) - toTime(b.lastUsedAt))[0] ?? null;
}

export function buildWeeklyRecommendations(summary, dishes = [], now = new Date()) {
  const recommendations = [];
  const staleDish = getStaleDishRecommendation(dishes, now);

  if (summary.totalMeals > 0 && summary.emptyMeals / summary.totalMeals >= 0.35) {
    recommendations.push({ type: 'empty-week', dishName: '', value: summary.emptyMeals });
  }

  if (summary.repeatedDishes.length) {
    recommendations.push({ type: 'repeated-dish', dishName: summary.repeatedDishes[0].name, value: summary.repeatedDishes[0].count });
  }

  if (staleDish) {
    recommendations.push({ type: 'stale-dish', dishName: staleDish.name, value: 0 });
  }

  if (!recommendations.length) {
    recommendations.push({ type: 'balanced-week', dishName: '', value: summary.plannedMeals });
  }

  return recommendations;
}

export function buildWeeklySummary({ menus = [], currentWeekStart, dishes = [], enabledMeals = ['lunch'], now = new Date() }) {
  const currentMenu = menus.find((menu) => menu.weekStart === currentWeekStart) ?? { weekStart: currentWeekStart, days: {} };
  const previousMenus = getComparableWeekMenus(menus, currentWeekStart).slice(0, 4);
  const current = summarizeWeek(currentMenu, enabledMeals);

  return {
    current,
    previousMenus: previousMenus.map((menu) => summarizeWeek(menu, enabledMeals)),
    comparison: compareWeekWithHistory(current, previousMenus, enabledMeals),
    topUsedDishes: getTopUsedDishes(menus, enabledMeals),
    latestAddedDish: getLatestAddedDish(dishes),
    recommendations: buildWeeklyRecommendations(current, dishes, now),
  };
}
