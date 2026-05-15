export const dishSortModes = ['most-used', 'recent', 'oldest', 'name'];
export const dishFilterModes = ['all', 'favorites', 'blocked'];
export const dishScopes = ['global', 'group', 'user'];

export function normalizeDishName(name) {
  return String(name ?? '')
    .trim()
    .toLocaleLowerCase('es-ES')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

export function getDishId(ownerId, normalizedName, scope = 'group') {
  return `${scope}_${ownerId}_${encodeURIComponent(normalizedName).replaceAll('%', '_')}`.slice(0, 1400);
}

export function isGlobalDish(dish) {
  return dish.scope === 'global' || dish.isGlobal === true;
}

export function isEditableDish(dish) {
  return Boolean(dish.editable) && !isGlobalDish(dish);
}

export function isSuggestableDish(dish) {
  return !dish.archived && !dish.blocked;
}

export function hasDishTag(dish, tag) {
  return Array.isArray(dish.quickTags) && dish.quickTags.includes(tag);
}

export function hasDishDuplicate(dishes, normalizedName, options = {}) {
  return dishes.some((dish) => {
    if (dish.id === options.excludeId) return false;
    if (dish.archived) return false;
    if (dish.normalizedName !== normalizedName) return false;
    return !options.scope || dish.scope === options.scope || isGlobalDish(dish);
  });
}

export function getDuplicateDish(dishes, normalizedName, options = {}) {
  return dishes.find((dish) => {
    if (dish.id === options.excludeId) return false;
    if (dish.archived) return false;
    if (dish.normalizedName !== normalizedName) return false;
    return !options.scope || dish.scope === options.scope || isGlobalDish(dish);
  });
}

export function filterDishes(dishes, query, options = {}) {
  const normalizedQuery = normalizeDishName(query);
  const mode = options.mode ?? 'all';
  const tag = options.tag ?? '';

  return dishes.filter((dish) => {
    if (mode === 'favorites' && !dish.favorite) return false;
    if (mode === 'blocked' && !dish.blocked) return false;
    if (mode === 'all' && dish.archived) return false;
    if (tag && !hasDishTag(dish, tag)) return false;
    if (!normalizedQuery) return true;

    return normalizeDishName(dish.name).includes(normalizedQuery);
  });
}

export function getSuggestionDishes(dishes, query = '') {
  return filterDishes(dishes, query, { mode: 'all' }).filter(isSuggestableDish);
}

function dateValue(value) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  return new Date(value).getTime() || 0;
}

function byName(a, b) {
  return a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
}

function preferenceScore(dish) {
  return (dish.favorite ? 2 : 0) - (dish.blocked ? 3 : 0) + (isGlobalDish(dish) ? 0.2 : 0);
}

export function sortDishes(dishes, mode = 'most-used') {
  return [...dishes].sort((a, b) => {
    if (mode === 'recent') {
      return dateValue(b.lastUsedAt) - dateValue(a.lastUsedAt) || preferenceScore(b) - preferenceScore(a) || b.timesUsed - a.timesUsed || byName(a, b);
    }

    if (mode === 'oldest') {
      return dateValue(a.lastUsedAt) - dateValue(b.lastUsedAt) || dateValue(a.createdAt) - dateValue(b.createdAt) || byName(a, b);
    }

    if (mode === 'name') {
      return byName(a, b);
    }

    return preferenceScore(b) - preferenceScore(a) || b.timesUsed - a.timesUsed || dateValue(b.lastUsedAt) - dateValue(a.lastUsedAt) || byName(a, b);
  });
}
