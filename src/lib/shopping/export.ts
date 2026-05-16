import { getToBuyItems } from './normalize.ts';
import type { ShoppingCategory, ShoppingItem } from './types.ts';

export function groupItemsByCategory(items: ShoppingItem[]) {
  const groups = new Map<ShoppingCategory, ShoppingItem[]>();

  items.forEach((item) => {
    const group = groups.get(item.category) ?? [];
    group.push(item);
    groups.set(item.category, group);
  });

  return [...groups.entries()].map(([category, categoryItems]) => ({
    category,
    items: categoryItems.sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' })),
  }));
}

export function buildShoppingListText(
  items: ShoppingItem[],
  options: {
    title: string;
    emptyLabel: string;
    categoryLabel: (category: ShoppingCategory) => string;
  }
) {
  const groups = groupItemsByCategory(getToBuyItems(items));

  if (groups.length === 0) {
    return `${options.title}\n\n${options.emptyLabel}`;
  }

  return [
    options.title,
    '',
    ...groups.flatMap(({ category, items: categoryItems }) => [
      `${options.categoryLabel(category)}`,
      ...categoryItems.map((item) => `- ${item.name}${item.quantity ? ` (${item.quantity})` : ''}`),
      '',
    ]),
  ]
    .join('\n')
    .trim();
}

export function createShoppingExportFilename(rangeStart: string, rangeEnd: string) {
  return `shopping-list-${rangeStart}-${rangeEnd}.txt`;
}
