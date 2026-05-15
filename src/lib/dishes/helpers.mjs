export const dishSortModes = ['most-used', 'recent', 'oldest', 'name'];

export function normalizeDishName(name) {
  return String(name ?? '')
    .trim()
    .toLocaleLowerCase('es-ES')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function getDishId(userId, normalizedName) {
  return `${userId}_${encodeURIComponent(normalizedName).replaceAll('%', '_')}`.slice(0, 1400);
}

export function filterDishes(dishes, query) {
  const normalizedQuery = normalizeDishName(query);
  if (!normalizedQuery) return [...dishes];

  return dishes.filter((dish) => normalizeDishName(dish.name).includes(normalizedQuery));
}

function dateValue(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  return new Date(value).getTime() || 0;
}

function byName(a, b) {
  return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
}

export function sortDishes(dishes, mode = 'most-used') {
  return [...dishes].sort((a, b) => {
    if (mode === 'recent') {
      return dateValue(b.lastUsedAt) - dateValue(a.lastUsedAt) || b.timesUsed - a.timesUsed || byName(a, b);
    }

    if (mode === 'oldest') {
      return dateValue(a.lastUsedAt) - dateValue(b.lastUsedAt) || dateValue(a.createdAt) - dateValue(b.createdAt) || byName(a, b);
    }

    if (mode === 'name') {
      return byName(a, b);
    }

    return b.timesUsed - a.timesUsed || dateValue(b.lastUsedAt) - dateValue(a.lastUsedAt) || byName(a, b);
  });
}
