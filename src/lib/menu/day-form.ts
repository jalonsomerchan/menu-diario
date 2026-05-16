import { normalizeDay } from './normalizers.ts';
import type { MealSlot } from './types.ts';

export function readDayDraft(card: HTMLElement, enabledMeals: MealSlot[]) {
  const skipped = card.querySelector<HTMLInputElement>('[data-field="skipped"]')?.checked ?? false;

  if (skipped) {
    return normalizeDay({
      skipped: true,
      reason: card.querySelector<HTMLSelectElement>('[data-field="reason"]')?.value ?? '',
      skipNote: card.querySelector<HTMLTextAreaElement>('[data-field="skipNote"]')?.value.trim() ?? '',
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
    skipped: false,
    notes: card.querySelector<HTMLTextAreaElement>('[data-field="notes"]')?.value.trim() ?? '',
    meals,
  });
}
