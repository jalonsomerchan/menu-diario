export const quickDishTags = [
  'quick',
  'cheap',
  'healthy',
  'vegetarian',
  'treat',
  'kids',
  'batch-cooking',
  'freezable',
] as const;

export type QuickDishTag = (typeof quickDishTags)[number];
