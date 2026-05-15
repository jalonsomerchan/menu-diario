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

function emptyMeal(): MealEntry {
  return { items: [], skipped: false, reason: '', note: '' };
}

function mealLabel(labels: DayEditorLabels, meal: MealSlot) {
  return labels[meal] ?? meal;
}

function renderReasonFields(labels: DayEditorLabels, reason = '', note = '') {
  return `
    <div class="day-skip-fields">
      <label>${escapeHtml(labels.reason)}
        <select data-field="reason">
          <option value=""></option>
          <option value="away" ${reason === 'away' ? 'selected' : ''}>${escapeHtml(labels.reasonAway)}</option>
          <option value="eating-out" ${reason === 'eating-out' ? 'selected' : ''}>${escapeHtml(labels.reasonEatingOut)}</option>
          <option value="not-hungry" ${reason === 'not-hungry' ? 'selected' : ''}>${escapeHtml(labels.reasonNotHungry)}</option>
          <option value="other" ${reason === 'other' ? 'selected' : ''}>${escapeHtml(labels.reasonOther)}</option>
        </select>
      </label>
      <label>${escapeHtml(labels.reasonDescription)}
        <textarea data-field="skipNote" rows="3">${escapeHtml(note)}</textarea>
      </label>
    </div>
  `;
}

function renderSuggestions(labels: DayEditorLabels, dayKey: string, meal: MealSlot, dishes: Dish[]) {
  if (!dishes.length) return '';

  return `
    <div class="dish-suggestions" role="listbox" aria-label="${escapeHtml(labels.dishSuggestions)}" data-suggestions="${dayKey}-${meal}">
      ${dishes
        .slice(0, 8)
        .map(
          (dish) =>
            `<button type="button" role="option" data-suggestion="${escapeHtml(dish.name)}">${escapeHtml(dish.name)}</button>`
        )
        .join('')}
    </div>
  `;
}

function renderMeal(labels: DayEditorLabels, dayKey: string, meal: MealSlot, mealData: MealEntry, dishes: Dish[]) {
  const values = mealData.items.length ? mealData.items : [''];

  return `
    <section class="meal-editor" data-meal="${meal}">
      <header class="meal-editor__header">
        <h4>${escapeHtml(mealLabel(labels, meal))}</h4>
        <button class="icon-button icon-button--primary" type="button" data-add-plate="${meal}" aria-label="${escapeHtml(labels.addPlate)}">
          <span aria-hidden="true">+</span>
        </button>
      </header>
      <div class="plate-list" data-plate-list="${meal}">
        ${values
          .map(
            (value, index) => `
              <div class="plate-row">
                <label>
                  <span class="sr-only">${escapeHtml(labels.addDish)} ${index + 1}</span>
                  <input type="text" value="${escapeHtml(value)}" data-plate-input="${meal}" placeholder="${escapeHtml(labels.dishPlaceholder)}" autocomplete="off" />
                </label>
                <button class="icon-button icon-button--danger" type="button" data-remove-plate="${meal}" aria-label="${escapeHtml(labels.removePlate)}">
                  <span aria-hidden="true">×</span>
                </button>
              </div>
            `
          )
          .join('')}
      </div>
      ${renderSuggestions(labels, dayKey, meal, dishes)}
    </section>
  `;
}

export function renderDayEditor(options: DayEditorOptions) {
  const { dayKey, dayNumber, weekday, dateLabel, day, enabledMeals, dishes, labels, compact = false } = options;
  const skipped = Boolean(day.skipped);
  const editorBody = skipped
    ? renderReasonFields(labels, day.reason, day.skipNote)
    : `
      <div class="day-meals-block">
        ${enabledMeals.map((meal) => renderMeal(labels, dayKey, meal, day.meals[meal] ?? emptyMeal(), dishes)).join('')}
        <label>${escapeHtml(labels.notes)}
          <textarea data-field="notes" rows="3">${escapeHtml(day.notes ?? '')}</textarea>
        </label>
      </div>
    `;

  return `
    <article class="day-card day-card--editor ${compact ? 'day-card--compact-editor' : ''}" id="dia-${dayKey}" data-day="${dayKey}">
      <div class="day-card__date-number">${escapeHtml(dayNumber)}</div>
      <div class="day-card__content">
        <header class="day-card__header">
          <div><h3>${escapeHtml(weekday)}</h3>${dateLabel ? `<p>${escapeHtml(dateLabel)}</p>` : ''}</div>
        </header>
        ${editorBody}
        <label class="checkbox-row day-skip-toggle">
          <input type="checkbox" data-field="skipped" ${skipped ? 'checked' : ''} />
          <span>${escapeHtml(labels.noDay)}</span>
        </label>
      </div>
    </article>
  `;
}
