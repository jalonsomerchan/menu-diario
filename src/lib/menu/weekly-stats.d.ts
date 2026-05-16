export function getComparableWeekMenus(menus?: any[], currentWeekStart?: string): any[];
export function summarizeWeek(menu?: any, enabledMeals?: string[]): any;
export function getTopUsedDishes(menus?: any[], enabledMeals?: string[], limit?: number): Array<{ name: string; count: number }>;
export function compareWeekWithHistory(currentSummary: any, previousMenus?: any[], enabledMeals?: string[]): any;
export function getLatestAddedDish(dishes?: any[]): any;
export function getStaleDishRecommendation(dishes?: any[], now?: Date): any;
export function buildWeeklyRecommendations(summary: any, dishes?: any[], now?: Date): any[];
export function buildWeeklySummary(input: {
  menus?: any[];
  currentWeekStart: string;
  dishes?: any[];
  enabledMeals?: string[];
  now?: Date;
}): any;
