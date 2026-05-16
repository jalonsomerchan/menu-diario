import { normalizeDay } from './normalizers.ts';
import type { DailyMenu, MealSlot } from './types.ts';

export function readDayDraft(card: HTMLElement, enabledMeals: MealSlot[], baseDay?: Partial<DailyMenu>) {
  const currentDay = normalizeDay(baseDay);
  const skipped = card.querySelector<HTMLInputElement>('[data-field="skipped"]')?.checked ?? false;

  if (skipped) {
    return normalizeDay({
      ...currentDay,
      skipped: true,
      reason: card.querySelector<HTMLSelectElement>('[data-field="reason"]')?.value ?? currentDay.reason ?? '',
      skipNote: card.querySelector<HTMLTextAreaElement>('[data-field="skipNote"]')?.value.trim() ?? currentDay.skipNote ?? '',
    });
  }

  const meals = Object.fromEntries(
    enabledMeals.map((meal) => [
      meal,
      {
        items: [...card.querySelectorAll<HTMLInputElement>(`[data-plate-input="${meal}"]`)]
          .map((input) => input.value.trim())
          .filter(Boolean),
      },
    ])
  );

  return normalizeDay({
    ...currentDay,
    skipped: false,
    notes: card.querySelector<HTMLTextAreaElement>('[data-field="notes"]')?.value.trim() ?? currentDay.notes ?? '',
    meals: {
      ...currentDay.meals,
      ...meals,
    },
  });
}
