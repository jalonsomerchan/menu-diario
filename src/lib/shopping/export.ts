import { getToBuyItems } from './normalize.ts';
import type { ShoppingItem } from './types.ts';

export function buildShoppingListText(
  items: ShoppingItem[],
  options: {
    title: string;
    emptyLabel: string;
  }
) {
  const pendingItems = getToBuyItems(items).sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));

  if (pendingItems.length === 0) {
    return `${options.title}\n\n${options.emptyLabel}`;
  }

  return [
    options.title,
    '',
    ...pendingItems.map((item) => `- ${item.name}${item.quantity ? ` (${item.quantity})` : ''}`),
  ]
    .join('\n')
    .trim();
}

export function createShoppingExportFilename(rangeStart: string, rangeEnd: string) {
  return `shopping-list-${rangeStart}-${rangeEnd}.txt`;
}
