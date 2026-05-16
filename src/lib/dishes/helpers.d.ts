export type DishSortMode = 'most-used' | 'recent' | 'oldest' | 'name';
export type DishFilterMode = 'all' | 'favorites' | 'blocked';

export type DishLike = {
  name: string;
  timesUsed: number;
  favorite?: boolean;
  blocked?: boolean;
  archived?: boolean;
  quickTags?: string[];
  createdAt?: Date | string;
  lastUsedAt?: Date | string;
};

export type DishFilterOptions = {
  mode?: DishFilterMode;
  tag?: string;
};

export const dishSortModes: DishSortMode[];
export const dishFilterModes: DishFilterMode[];
export function cleanDishName(name: unknown): string;
export function normalizeDishName(name: unknown): string;
export function getDishId(userId: string, normalizedName: string): string;
export function createGlobalDishId(normalizedName: string): string;
export function normalizeStringList(values: unknown): string[];
export function isSuggestableDish<T extends DishLike>(dish: T): boolean;
export function hasDishTag<T extends DishLike>(dish: T, tag: string): boolean;
export function filterDishes<T extends DishLike>(dishes: T[], query: string, options?: DishFilterOptions): T[];
export function getSuggestionDishes<T extends DishLike>(dishes: T[], query?: string): T[];
export function sortDishes<T extends DishLike>(dishes: T[], mode?: DishSortMode): T[];
