import type { DailyMenu, DailyOption } from './types';

export const dailyOptionColors = ['blue', 'green', 'orange', 'rose', 'violet', 'slate'] as const;
export const dailyOptionIcons = ['clock', 'utensils', 'kids', 'training', 'no-cook', 'note'] as const;

export type DailyOptionColor = (typeof dailyOptionColors)[number];
export type DailyOptionIcon = (typeof dailyOptionIcons)[number];

export function normalizeDailyOptionName(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
}

export function normalizeDailyOptionDescription(value: unknown) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 180);
}

export function normalizeDailyOptionColor(value: unknown): DailyOptionColor {
  return dailyOptionColors.includes(value as DailyOptionColor) ? value as DailyOptionColor : 'blue';
}

export function normalizeDailyOptionIcon(value: unknown): DailyOptionIcon {
  return dailyOptionIcons.includes(value as DailyOptionIcon) ? value as DailyOptionIcon : 'note';
}

export function getActiveDailyOptions(options: DailyOption[]) {
  return options.filter((option) => option.active).sort((first, second) => first.order - second.order || first.name.localeCompare(second.name));
}

export function getSelectedDailyOptions(day: Partial<DailyMenu>, options: DailyOption[]) {
  const selectedIds = new Set(day.optionIds ?? []);
  return options
    .filter((option) => selectedIds.has(option.id))
    .sort((first, second) => first.order - second.order || first.name.localeCompare(second.name));
}

export function getDailyOptionPromptHints(day: Partial<DailyMenu>, options: DailyOption[]) {
  return getSelectedDailyOptions(day, options).map((option) => {
    const description = option.description ? `: ${option.description}` : '';
    return `${option.name}${description}`;
  });
}
