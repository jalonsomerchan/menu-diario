import { emptyMeal } from './normalizers';
import type { DailyMenu, Dish, MealEntry, MealSlot } from './types';

type DayEditorLabels = Record<string, string>;

type DayEditorOptions = {
  dayKey: string;
  dayNumber: string;
  weekday: string;
  dateLabel?: string;
  day: DailyMenu;
  enabledMeals: MealSlot[];
  dishes: Dish[];
  labels: DayEditorLabels;
  compact?: boolean;
};

function escapeHtml(value = '') {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function mealLabel(labels: DayEditorLabels, meal: MealSlot) {
  return labels[meal] ?? meal;
}

function renderReasonFields(labels: DayEditorLabels, reason = '', note = '') {
  return `
    <section class="day-edit-block day-edit-block--skip" data-day-skip-fields>
      <label class="day-edit-field">${escapeHtml(labels.reason)}
        <select data-field="reason">
          <option value=""></option>
          <option value="away" ${reason === 'away' ? 'selected' : ''}>${escapeHtml(labels.reasonAway)}</option>
          <option value="eating-out" ${reason === 'eating-out' ? 'selected' : ''}>${escapeHtml(labels.reasonEatingOut)}</option>
          <option value="not-hungry" ${reason === 'not-hungry' ? 'selected' : ''}>${escapeHtml(labels.reasonNotHungry)}</option>
          <option value="other" ${reason === 'other' ? 'selected' : ''}>${escapeHtml(labels.reasonOther)}</option>
        </select>
      </label>
      <label class="day-edit-field day-edit-field--textarea">${escapeHtml(labels.reasonDescription)}
        <textarea data-field="skipNote" rows="3">${escapeHtml(note)}</textarea>
      </label>
    </section>
  `;
}

function renderSuggestionContainer(labels: DayEditorLabels, meal: MealSlot, dishes: Dish[]) {
  const hasSuggestions = dishes.length > 0;

  return `
    <div class="dish-suggestions" role="listbox" aria-label="${escapeHtml(labels.dishSuggestions)}" data-suggestion-list="${meal}" ${hasSuggestions ? '' : 'hidden'}></div>
  `;
}

function renderDishControl(labels: DayEditorLabels, meal: MealSlot, value: string) {
  return `
    <span class="dish-combobox" data-dish-combobox>
      <input type="text" role="combobox" value="${escapeHtml(value)}" data-plate-input="${meal}" placeholder="${escapeHtml(labels.dishPlaceholder)}" autocomplete="off" aria-autocomplete="list" aria-expanded="false" />
      <button class="dish-combobox__toggle" type="button" data-suggestion-toggle="${meal}" aria-label="${escapeHtml(labels.showDishOptions)}">
        <span aria-hidden="true">▾</span>
      </button>
    </span>
  `;
}

export function renderPlateRow(labels: DayEditorLabels, meal: MealSlot, value = '', index = 0, dishes: Dish[] = []) {
  return `
    <div class="plate-row">
      <label>
        <span class="sr-only">${escapeHtml(labels.addDish)} ${index + 1}</span>
        ${renderDishControl(labels, meal, value)}
        ${renderSuggestionContainer(labels, meal, dishes)}
      </label>
      <button class="icon-button icon-button--danger" type="button" data-remove-plate="${meal}" aria-label="${escapeHtml(labels.removePlate)}">
        <span aria-hidden="true">×</span>
      </button>
    </div>
  `;
}

function renderMeal(labels: DayEditorLabels, meal: MealSlot, mealData: MealEntry, dishes: Dish[]) {
  const values = mealData.items.length ? mealData.items : [''];

  return `
    <section class="meal-editor day-edit-block" data-meal="${meal}">
      <header class="meal-editor__header">
        <div class="meal-editor__title">
          <h4>${escapeHtml(mealLabel(labels, meal))}</h4>
        </div>
        <button class="icon-button icon-button--primary" type="button" data-add-plate="${meal}" aria-label="${escapeHtml(labels.addPlate)}">
          <span aria-hidden="true">+</span>
        </button>
      </header>
      <div class="plate-list" data-plate-list="${meal}">
        ${values.map((value, index) => renderPlateRow(labels, meal, value, index, dishes)).join('')}
      </div>
    </section>
  `;
}

export function renderDayEditor(options: DayEditorOptions) {
  const { dayKey, dayNumber, weekday, dateLabel, day, enabledMeals, dishes, labels, compact = false } = options;
  const skipped = Boolean(day.skipped);
  const editorBody = skipped
    ? renderReasonFields(labels, day.reason, day.skipNote)
    : `
      <div class="day-meals-block" data-day-meals-block>
        ${enabledMeals.map((meal) => renderMeal(labels, meal, day.meals[meal] ?? emptyMeal(), dishes)).join('')}
        <label class="day-edit-field day-edit-field--textarea day-edit-block day-edit-notes">${escapeHtml(labels.notes)}
          <textarea data-field="notes" rows="3">${escapeHtml(day.notes ?? '')}</textarea>
        </label>
      </div>
    `;

  return `
    <article class="day-card day-card--editor ${compact ? 'day-card--compact-editor' : ''}" id="dia-${dayKey}" data-day="${dayKey}" data-day-mode="${skipped ? 'skipped' : 'meals'}">
      <header class="day-card__header">
        <div class="day-card__date-number">${escapeHtml(dayNumber)}</div>
        <div class="day-card__title"><h3>${escapeHtml(weekday)}</h3>${dateLabel ? `<p>${escapeHtml(dateLabel)}</p>` : ''}</div>
      </header>
      <div class="day-card__content day-edit-card__content">
        ${editorBody}
        <label class="checkbox-row day-skip-toggle day-edit-block day-edit-toggle-card">
          <input type="checkbox" data-field="skipped" ${skipped ? 'checked' : ''} />
          <span>${escapeHtml(labels.noDay)}</span>
        </label>
      </div>
    </article>
  `;
}
