import type {
  ShoppingAiResponseItem,
  ShoppingCategory,
  ShoppingConfidence,
  ShoppingItem,
  ShoppingItemSource,
  ShoppingItemStatus,
} from './types.ts';

const categoryAliases: Record<string, ShoppingCategory> = {
  verdura: 'vegetables',
  verduras: 'vegetables',
  vegetable: 'vegetables',
  vegetables: 'vegetables',
  hortalizas: 'vegetables',
  fruta: 'fruit',
  frutas: 'fruit',
  fruit: 'fruit',
  meat: 'meat',
  carne: 'meat',
  carnes: 'meat',
  fish: 'fish',
  pescado: 'fish',
  pescados: 'fish',
  dairy: 'dairy',
  lacteo: 'dairy',
  lacteos: 'dairy',
  dairyproducts: 'dairy',
  egg: 'eggs',
  eggs: 'eggs',
  huevo: 'eggs',
  huevos: 'eggs',
  bakery: 'bakery',
  panaderia: 'bakery',
  bread: 'bakery',
  pantry: 'pantry',
  despensa: 'pantry',
  seco: 'pantry',
  secos: 'pantry',
  frozen: 'frozen',
  congelado: 'frozen',
  congelados: 'frozen',
  drinks: 'drinks',
  bebida: 'drinks',
  bebidas: 'drinks',
  snacks: 'snacks',
  snack: 'snacks',
  household: 'household',
  limpieza: 'household',
  hogar: 'household',
  other: 'other',
  otros: 'other',
  otra: 'other',
};

export function normalizeShoppingName(value = '') {
  return value
    .trim()
    .toLocaleLowerCase('es-ES')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeShoppingCategory(value: string): ShoppingCategory {
  const normalized = normalizeShoppingName(value).replace(/\s+/g, '');
  return categoryAliases[normalized] ?? 'other';
}

export function normalizeShoppingQuantity(value = '') {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeShoppingConfidence(value: string): ShoppingConfidence {
  return value === 'high' || value === 'low' ? value : 'medium';
}

export function createShoppingItemId(name: string, category: string) {
  const normalizedName = normalizeShoppingName(name);
  const normalizedCategory = normalizeShoppingCategory(category);
  return `${normalizedCategory}:${normalizedName}`.replace(/\s+/g, '-');
}

export function createManualShoppingItemId() {
  return `manual:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeMealRefs(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

export function normalizeShoppingItem(
  item: Partial<ShoppingItem> &
    Pick<ShoppingItem, 'name'> & {
      category?: string;
      source?: ShoppingItemSource;
      status?: ShoppingItemStatus;
      confidence?: ShoppingConfidence;
    },
  index = 0
): ShoppingItem {
  const cleanName = item.name.trim();
  const normalizedName = normalizeShoppingName(cleanName);
  const category = normalizeShoppingCategory(item.category ?? item.name);
  const checked = Boolean(item.checked ?? item.status === 'owned');
  const status = item.status ?? (checked ? 'owned' : 'to-buy');
  const order = Number(item.order);

  return {
    id: item.id?.trim() || createShoppingItemId(cleanName, category),
    name: cleanName,
    normalizedName,
    category,
    quantity: normalizeShoppingQuantity(item.quantity ?? ''),
    note: normalizeShoppingQuantity(item.note ?? ''),
    checked,
    order: Number.isFinite(order) ? order : index,
    status,
    forMeals: normalizeMealRefs(item.forMeals ?? []),
    source: item.source ?? 'manual',
    confidence: item.confidence ?? 'medium',
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function groupShoppingItems(items: ShoppingItem[]) {
  const grouped = new Map<string, ShoppingItem>();

  items.forEach((item, index) => {
    if (!item.name.trim()) {
      return;
    }

    const normalized = normalizeShoppingItem(item, index);
    const shouldKeepUnique = normalized.id.startsWith('manual:') || normalized.note.trim();
    const key = shouldKeepUnique ? normalized.id : `${normalized.category}:${normalized.normalizedName}`;
    const existing = grouped.get(key);
    if (!existing) {
      grouped.set(key, normalized);
      return;
    }

    grouped.set(key, {
      ...existing,
      quantity: mergeQuantities(existing.quantity, normalized.quantity),
      note: existing.note || normalized.note,
      checked: existing.checked && normalized.checked,
      order: Math.min(existing.order, normalized.order),
      forMeals: normalizeMealRefs([...existing.forMeals, ...normalized.forMeals]),
      status: existing.status === 'to-buy' || normalized.status === 'to-buy' ? 'to-buy' : existing.status,
      source: existing.source === 'manual' || normalized.source === 'manual' ? 'manual' : 'ai',
      confidence: pickHighestConfidence(existing.confidence, normalized.confidence),
    });
  });

  return [...grouped.values()].sort((left, right) => {
    if (left.checked !== right.checked) return left.checked ? 1 : -1;
    if (left.order !== right.order) return left.order - right.order;
    if (left.category !== right.category) return left.category.localeCompare(right.category);
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  });
}

export function fromAiResponseItems(items: ShoppingAiResponseItem[]) {
  return groupShoppingItems(
    items.map((item, index) =>
      normalizeShoppingItem(
        {
          name: item.name,
          category: item.category,
          quantity: item.quantity,
          forMeals: item.forMeals,
          source: 'ai',
          confidence: normalizeShoppingConfidence(item.confidence),
          status: 'to-buy',
          checked: false,
          order: index,
        },
        index
      )
    )
  );
}

export function mergeShoppingDraftItems(currentItems: ShoppingItem[], nextAiItems: ShoppingItem[]) {
  const manualItems = currentItems.filter((item) => item.source === 'manual');
  return groupShoppingItems([...manualItems, ...nextAiItems]);
}

export function getToBuyItems(items: ShoppingItem[]) {
  return items.filter((item) => !item.checked && item.status === 'to-buy' && item.name.trim());
}

function mergeQuantities(left: string, right: string) {
  if (!left) return right;
  if (!right || left === right) return left;
  return `${left} + ${right}`;
}

function pickHighestConfidence(left: ShoppingConfidence, right: ShoppingConfidence): ShoppingConfidence {
  const ranks: Record<ShoppingConfidence, number> = { low: 0, medium: 1, high: 2 };
  return ranks[left] >= ranks[right] ? left : right;
}
