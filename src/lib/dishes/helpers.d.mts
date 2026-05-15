export type DishSortMode = 'most-used' | 'recent' | 'oldest' | 'name';

export type DishLike = {
  name: string;
  timesUsed: number;
  createdAt?: Date | string;
  lastUsedAt?: Date | string;
};

export const dishSortModes: DishSortMode[];
export function normalizeDishName(name: unknown): string;
export function getDishId(userId: string, normalizedName: string): string;
export function filterDishes<T extends DishLike>(dishes: T[], query: string): T[];
export function sortDishes<T extends DishLike>(dishes: T[], mode?: DishSortMode): T[];
