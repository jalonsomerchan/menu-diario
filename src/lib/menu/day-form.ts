import { getStoredParticipantIds } from './participants.ts';
import { normalizeDay } from './normalizers.ts';
import type { DailyMenu, MealSlot, MenuParticipant } from './types.ts';

export function readDayDraft(
  card: HTMLElement,
  enabledMeals: MealSlot[],
  baseDay?: Partial<DailyMenu>,
  participants: MenuParticipant[] = []
) {
  const currentDay = normalizeDay(baseDay);
  const skipped = card.querySelector<HTMLInputElement>('[data-field="skipped"]')?.checked ?? false;

  if (skipped) {
    return normalizeDay({
      ...currentDay,
      skipped: true,
      optionIds: [...card.querySelectorAll<HTMLInputElement>('[data-day-option-input]')]
        .filter((input) => input.checked)
        .map((input) => input.value),
      reason: card.querySelector<HTMLSelectElement>('[data-field="reason"]')?.value ?? currentDay.reason ?? '',
      skipNote: card.querySelector<HTMLTextAreaElement>('[data-field="skipNote"]')?.value.trim() ?? currentDay.skipNote ?? '',
    });
  }

  const meals = Object.fromEntries(
    enabledMeals.map((meal) => {
      const selectedIds = [...card.querySelectorAll<HTMLInputElement>(`[data-participant-input="${meal}"]`)]
        .filter((input) => input.checked)
        .map((input) => input.value);
      const participantIds = getStoredParticipantIds(selectedIds, participants);

      return [
        meal,
        {
          ...currentDay.meals[meal],
          items: [...card.querySelectorAll<HTMLInputElement>(`[data-plate-input="${meal}"]`)]
            .map((input) => input.value.trim())
            .filter(Boolean),
          ...(participantIds === undefined ? { participantIds: undefined } : { participantIds }),
        },
      ];
    })
  );

  return normalizeDay({
    ...currentDay,
    skipped: false,
    optionIds: [...card.querySelectorAll<HTMLInputElement>('[data-day-option-input]')]
      .filter((input) => input.checked)
      .map((input) => input.value),
    notes: card.querySelector<HTMLTextAreaElement>('[data-field="notes"]')?.value.trim() ?? currentDay.notes ?? '',
    meals: {
      ...currentDay.meals,
      ...meals,
    },
  });
}
