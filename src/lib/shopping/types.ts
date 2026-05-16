export const shoppingItemStatuses = ['to-buy', 'owned', 'dismissed'] as const;
export type ShoppingItemStatus = (typeof shoppingItemStatuses)[number];

export const shoppingItemSources = ['ai', 'manual'] as const;
export type ShoppingItemSource = (typeof shoppingItemSources)[number];

export const shoppingConfidenceLevels = ['low', 'medium', 'high'] as const;
export type ShoppingConfidence = (typeof shoppingConfidenceLevels)[number];

export const shoppingCategories = [
  'vegetables',
  'fruit',
  'meat',
  'fish',
  'dairy',
  'eggs',
  'bakery',
  'pantry',
  'frozen',
  'drinks',
  'snacks',
  'household',
  'other',
] as const;

export type ShoppingCategory = (typeof shoppingCategories)[number];
export type ShoppingScope = 'user' | 'group';

export type ShoppingItem = {
  id: string;
  name: string;
  normalizedName: string;
  category: ShoppingCategory;
  quantity: string;
  status: ShoppingItemStatus;
  forMeals: string[];
  source: ShoppingItemSource;
  confidence: ShoppingConfidence;
  createdAt?: Date;
  updatedAt?: Date;
};

export type ShoppingListDocument = {
  id: string;
  ownerId: string;
  groupId?: string;
  scope: ShoppingScope;
  source: 'ai' | 'mixed' | 'manual';
  rangeStart: string;
  rangeEnd: string;
  items: ShoppingItem[];
  createdAt?: Date;
  updatedAt?: Date;
  updatedBy?: string;
};

export type ShoppingRecipeIngredient = {
  name: string;
  quantity?: string;
  category?: string;
};

export type ShoppingMealContext = {
  dayKey: string;
  meal: string;
  dishes: string[];
  note?: string;
  recipeIngredients: ShoppingRecipeIngredient[];
};

export type ShoppingInventoryHint = {
  name: string;
  portions?: number;
  expiresAt?: string;
  location?: string;
};

export type ShoppingAiRequestContext = {
  locale: string;
  meals: ShoppingMealContext[];
  inventoryHints: ShoppingInventoryHint[];
};

export type ShoppingAiResponseItem = {
  name: string;
  category: string;
  quantity: string;
  forMeals: string[];
  confidence: ShoppingConfidence;
};

export type ShoppingAiResponse = {
  items: ShoppingAiResponseItem[];
};
