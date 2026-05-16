import { readDayDraft } from './day-form';
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
  onScheduleSave: (card: HTMLElement) => void;
  onFlushSave: (dayKey: string) => Promise<void>;
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
  let activeDayKey = '';

  if (!modal || !form || !fields) {
    return {
      open: (_dayKey: string, _config?: OpenDayEditModalOptions) => {},
      applyRecommendedDishes: (_dayKey: string, _meal: MealSlot, _dishes: string[]) => {},
    };
  }

  function setHeading(dayKey: string) {
    if (title) {
      title.textContent = options.getWeekday(dayKey);
    }

    if (subtitle) {
      subtitle.textContent = options.getDateLabel?.(dayKey) ?? '';
    }
  }

  function render(dayKey: string, day: DailyMenu) {
    activeDayKey = dayKey;
    setHeading(dayKey);
    fields.innerHTML = renderDayEditor({
      dayKey,
      dayNumber: options.getDayNumber(dayKey),
      weekday: options.getWeekday(dayKey),
      dateLabel: options.getDateLabel?.(dayKey),
      day,
      enabledMeals: options.getEnabledMeals(),
      dishes: options.getDishes(),
      labels: options.labels,
      compact: true,
    });
    fields
      .querySelector<HTMLElement>('[data-day]')
      ?.setAttribute('data-day-state', options.getSavedDayState(dayKey));
  }

  function open(dayKey: string, config: OpenDayEditModalOptions = {}) {
    render(dayKey, normalizeDay(config.day ?? options.getDay(dayKey)));
    if (!modal.open) {
      modal.showModal();
    }
  }

  function applyRecommendedDishes(dayKey: string, meal: MealSlot, dishes: string[]) {
    const currentDay = normalizeDay(options.getDay(dayKey));
    const nextDay = normalizeDay({
      ...currentDay,
      skipped: false,
      reason: '',
      skipNote: '',
      meals: {
        ...currentDay.meals,
        [meal]: {
          ...currentDay.meals[meal],
          skipped: false,
          reason: '',
          note: '',
          items: dishes,
        },
      },
    });

    open(dayKey, { day: nextDay });
  }

  fields.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLTextAreaElement || target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;

    const card = target.closest<HTMLElement>('[data-day]');
    if (!card) return;

    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      const nextDay = readDayDraft(card, options.getEnabledMeals());
      render(card.dataset.day ?? activeDayKey, nextDay);
    }

    const nextCard = fields.querySelector<HTMLElement>('[data-day]');
    if (nextCard) {
      options.onScheduleSave(nextCard);
    }
  });

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
      list.querySelector<HTMLInputElement>('.plate-row:last-child input')?.focus();
      return;
    }

    if (button.dataset.removePlate) {
      button.closest('.plate-row')?.remove();
      options.onScheduleSave(card);
    }
  });

  form.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const clearButton = target.closest<HTMLButtonElement>('[data-day-edit-clear]');
    if (!clearButton || !activeDayKey) return;

    const cleared = await options.onClearDay(activeDayKey);
    if (cleared !== false) {
      modal.close();
    }
  });

  form.addEventListener('submit', async (event) => {
    const submitter = (event as SubmitEvent).submitter;
    if (!(submitter instanceof HTMLButtonElement) || submitter.value !== 'save' || !activeDayKey) {
      return;
    }

    event.preventDefault();
    await options.onFlushSave(activeDayKey);
    modal.close();
  });

  return {
    open,
    applyRecommendedDishes,
  };
}
