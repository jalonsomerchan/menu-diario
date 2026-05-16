import { readDayDraft } from './day-form';
import { appendRecommendedMealDraft, applyRecommendedMealDraft, setDaySkippedDraft } from './day-edit-draft.mjs';
import { renderDayEditor, renderPlateRow } from './day-editor';
import { normalizeDay } from './normalizers';
import { serializeDay } from './day-state';
import type { DailyMenu, Dish, MealSlot } from './types';

type DayEditModalLabels = Record<string, string>;

type DayEditModalControllerOptions = {
  root: HTMLElement;
  labels: DayEditModalLabels;
  getDay: (dayKey: string) => DailyMenu;
  getDishes: () => Dish[];
  getEnabledMeals: () => MealSlot[];
  getSavedDayState: (dayKey: string) => string;
  getDayNumber: (dayKey: string) => string;
  getWeekday: (dayKey: string) => string;
  getDateLabel?: (dayKey: string) => string | undefined;
  canWrite: () => boolean;
  getWriteErrorMessage: () => string;
  onSaveDay: (dayKey: string, nextDay: DailyMenu, card: HTMLElement) => Promise<boolean | void>;
  onClearDay: (dayKey: string) => Promise<boolean | void>;
};

type OpenDayEditModalOptions = {
  day?: DailyMenu;
};

export function createDayEditModalController(options: DayEditModalControllerOptions) {
  const modal = options.root.querySelector<HTMLDialogElement>('[data-day-edit-modal]');
  const form = options.root.querySelector<HTMLFormElement>('[data-day-edit-form]');
  const fields = options.root.querySelector<HTMLElement>('[data-day-edit-fields]');
  const title = options.root.querySelector<HTMLElement>('[data-day-edit-title]');
  const subtitle = options.root.querySelector<HTMLElement>('[data-day-edit-subtitle]');
  const dayNumber = options.root.querySelector<HTMLElement>('[data-day-edit-number]');
  const saveButton = options.root.querySelector<HTMLButtonElement>('[data-day-edit-save]');
  const saveState = options.root.querySelector<HTMLElement>('[data-day-edit-save-state]');
  const clearButton = options.root.querySelector<HTMLButtonElement>('[data-day-edit-clear]');
  const defaultSaveState = saveState?.textContent ?? '';
  const pendingSaveState = saveState?.dataset.pendingLabel ?? options.labels.savePending ?? defaultSaveState;
  let activeDayKey = '';
  let draftDay = normalizeDay(undefined);
  let returnFocusTo: HTMLElement | null = null;

  if (!modal || !form || !fields) {
    return {
      open: (_dayKey: string, _config?: OpenDayEditModalOptions) => {},
      applyRecommendedDishes: (_dayKey: string, _meal: MealSlot, _dishes: string[]) => {},
      appendRecommendedDish: (_dayKey: string, _meal: MealSlot, _dish: string) => {},
    };
  }

  function setHeading(dayKey: string) {
    if (title) {
      title.textContent = options.getWeekday(dayKey);
    }

    if (subtitle) {
      subtitle.textContent = options.getDateLabel?.(dayKey) ?? '';
    }

    if (dayNumber) {
      dayNumber.textContent = options.getDayNumber(dayKey);
    }
  }

  function setSaveMessage(message: string, variant: 'idle' | 'pending' | 'saving' | 'saved' | 'error' = 'idle') {
    if (!saveState) return;
    saveState.textContent = message;
    saveState.dataset.variant = variant;
    if (variant === 'error') {
      saveState.setAttribute('role', 'alert');
    } else {
      saveState.setAttribute('role', 'status');
    }
  }

  function setSaveBusy(isBusy: boolean) {
    if (saveButton) {
      saveButton.disabled = isBusy;
      saveButton.setAttribute('aria-busy', String(isBusy));
    }
    if (clearButton) clearButton.disabled = isBusy || !options.canWrite();
    if (isBusy) {
      setSaveMessage(options.labels.saveSaving || defaultSaveState, 'saving');
    }
  }

  function setEditableState(canWrite: boolean) {
    const controls = fields.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement>(
      'input, textarea, select, button'
    );
    controls.forEach((control) => {
      control.disabled = !canWrite;
      if (!canWrite) {
        control.setAttribute('aria-disabled', 'true');
      } else {
        control.removeAttribute('aria-disabled');
      }
    });
    if (saveButton) saveButton.disabled = !canWrite;
    if (clearButton) clearButton.disabled = !canWrite;
  }

  function getEditorCard() {
    return fields.querySelector<HTMLElement>('[data-day]');
  }

  function render(dayKey: string, day: DailyMenu) {
    activeDayKey = dayKey;
    draftDay = normalizeDay(day);
    setHeading(dayKey);
    setSaveBusy(false);
    fields.innerHTML = renderDayEditor({
      dayKey,
      dayNumber: options.getDayNumber(dayKey),
      weekday: options.getWeekday(dayKey),
      dateLabel: options.getDateLabel?.(dayKey),
      day: draftDay,
      enabledMeals: options.getEnabledMeals(),
      dishes: options.getDishes(),
      labels: options.labels,
      compact: true,
    });
    getEditorCard()?.setAttribute('data-day-state', options.getSavedDayState(dayKey));
    setEditableState(options.canWrite());
    setSaveMessage(options.canWrite() ? defaultSaveState : options.getWriteErrorMessage(), options.canWrite() ? 'idle' : 'error');
  }

  function open(dayKey: string, config: OpenDayEditModalOptions = {}) {
    returnFocusTo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    render(dayKey, normalizeDay(config.day ?? options.getDay(dayKey)));
    if (!modal.open) {
      modal.showModal();
    }
    const firstField =
      fields.querySelector<HTMLElement>('input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled])') ??
      form.querySelector<HTMLElement>('[data-day-edit-cancel], [data-day-edit-cancel-footer]');
    firstField?.focus();
  }

  function applyRecommendedDishes(dayKey: string, meal: MealSlot, dishes: string[]) {
    const currentDay = activeDayKey === dayKey ? draftDay : normalizeDay(options.getDay(dayKey));
    const nextDay = applyRecommendedMealDraft(currentDay, meal, dishes);

    open(dayKey, { day: nextDay });
  }

  function appendRecommendedDish(dayKey: string, meal: MealSlot, dish: string) {
    const currentDay = activeDayKey === dayKey ? draftDay : normalizeDay(options.getDay(dayKey));
    const nextDay = appendRecommendedMealDraft(currentDay, meal, dish);

    open(dayKey, { day: nextDay });
  }

  function refreshDraftFromDom(card: HTMLElement) {
    draftDay = readDayDraft(card, options.getEnabledMeals(), draftDay);
    return draftDay;
  }

  function markDirty() {
    if (!options.canWrite()) {
      setSaveMessage(options.getWriteErrorMessage(), 'error');
      return;
    }
    setSaveMessage(pendingSaveState, 'pending');
  }

  function focusModeField(skipped: boolean) {
    const selector = skipped ? '[data-field="reason"]' : '[data-plate-input], [data-field="notes"]';
    fields.querySelector<HTMLElement>(selector)?.focus();
  }

  function rerenderDraft(nextDay: DailyMenu, shouldFocusModeField = false) {
    render(activeDayKey, nextDay);
    if (shouldFocusModeField) {
      requestAnimationFrame(() => focusModeField(Boolean(nextDay.skipped)));
    }
  }

  function handleDraftMutation(event: Event) {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

    const card = target.closest<HTMLElement>('[data-day]');
    if (!card) return;

    const nextDay = refreshDraftFromDom(card);
    if (target instanceof HTMLInputElement && target.type === 'checkbox' && target.dataset.field === 'skipped') {
      rerenderDraft(setDaySkippedDraft(nextDay, target.checked), true);
      markDirty();
      return;
    }

    draftDay = nextDay;
    markDirty();
  }

  fields.addEventListener('input', handleDraftMutation);
  fields.addEventListener('change', handleDraftMutation);

  fields.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest<HTMLButtonElement>('button');
    if (!button) return;

    const card = button.closest<HTMLElement>('[data-day]');
    if (!card) return;

    if (button.dataset.addPlate) {
      const meal = button.dataset.addPlate as MealSlot;
      const list = card.querySelector<HTMLElement>(`[data-plate-list="${meal}"]`);
      if (!list) return;

      list.insertAdjacentHTML(
        'beforeend',
        renderPlateRow(options.labels, meal, '', list.children.length, options.getDishes())
      );
      markDirty();
      list.querySelector<HTMLInputElement>('.plate-row:last-child input')?.focus();
      return;
    }

    if (button.dataset.removePlate) {
      button.closest('.plate-row')?.remove();
      refreshDraftFromDom(card);
      markDirty();
    }
  });

  form.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const cancelButton = target.closest<HTMLButtonElement>('[data-day-edit-cancel], [data-day-edit-cancel-footer]');
    if (cancelButton) {
      modal.close('cancel');
      return;
    }

    const clearAction = target.closest<HTMLButtonElement>('[data-day-edit-clear]');
    if (!clearAction || !activeDayKey) return;

    if (!options.canWrite()) {
      setSaveMessage(options.getWriteErrorMessage(), 'error');
      return;
    }
    try {
      const cleared = await options.onClearDay(activeDayKey);
      if (cleared !== false) {
        modal.close();
        return;
      }
      setSaveMessage(options.getWriteErrorMessage(), 'error');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveMessage(message, 'error');
    }
  });

  form.addEventListener('submit', async (event) => {
    const submitter = (event as SubmitEvent).submitter;
    if (!(submitter instanceof HTMLButtonElement) || submitter.value !== 'save' || !activeDayKey) {
      return;
    }

    event.preventDefault();
    const card = getEditorCard();
    if (!card) return;
    if (!options.canWrite()) {
      setSaveMessage(options.getWriteErrorMessage(), 'error');
      return;
    }

    try {
      draftDay = readDayDraft(card, options.getEnabledMeals(), draftDay);
      setSaveBusy(true);
      await options.onSaveDay(activeDayKey, draftDay, card);
      setSaveMessage(options.labels.saveSaved || defaultSaveState, 'saved');
      modal.close();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSaveMessage(message, 'error');
    } finally {
      if (saveButton) {
        saveButton.disabled = !options.canWrite();
        saveButton.setAttribute('aria-busy', 'false');
      }
      if (clearButton) clearButton.disabled = !options.canWrite();
    }
  });

  modal.addEventListener('close', () => {
    returnFocusTo?.focus();
    returnFocusTo = null;
  });

  return {
    open,
    applyRecommendedDishes,
    appendRecommendedDish,
  };
}
