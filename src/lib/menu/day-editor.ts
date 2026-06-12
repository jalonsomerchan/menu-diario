import { getParticipantDisplayName, getParticipantInitials, getSelectedParticipantIds } from './participants';
import { emptyMeal } from './normalizers';
import { getActiveDailyOptions } from './daily-options';
import type { DailyMenu, DailyOption, Dish, MealEntry, MealSlot, MenuParticipant } from './types';

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
  participants?: MenuParticipant[];
  dailyOptions?: DailyOption[];
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

function renderSkipToggle(labels: DayEditorLabels, skipped: boolean) {
  return `
    <label class="checkbox-row day-skip-toggle day-edit-block day-edit-toggle-card">
      <input type="checkbox" data-field="skipped" ${skipped ? 'checked' : ''} />
      <span>${escapeHtml(labels.noDay)}</span>
    </label>
  `;
}

function renderDailyOptions(labels: DayEditorLabels, day: DailyMenu, dailyOptions: DailyOption[], compact = false) {
  const options = getActiveDailyOptions(dailyOptions);
  if (!options.length) return '';

  const selectedIds = new Set(day.optionIds ?? []);
  return `
    <fieldset class="day-options day-edit-block ${compact ? 'day-options--compact' : ''}">
      <legend>${escapeHtml(labels.dailyOptionsTitle)}</legend>
      ${compact ? '' : `<p>${escapeHtml(labels.dailyOptionsDescription)}</p>`}
      <div class="day-options__grid">
        ${options
          .map((option) => `
            <label class="day-option-chip day-option-chip--${escapeHtml(option.color)}">
              <input type="checkbox" value="${escapeHtml(option.id)}" data-day-option-input ${selectedIds.has(option.id) ? 'checked' : ''} />
              <span class="day-option-chip__icon" aria-hidden="true">${escapeHtml(option.icon)}</span>
              <span class="day-option-chip__body">
                <span>${escapeHtml(option.name)}</span>
                ${option.description ? `<small>${escapeHtml(option.description)}</small>` : ''}
              </span>
            </label>
          `)
          .join('')}
      </div>
    </fieldset>
  `;
}

function renderSuggestionContainer(labels: DayEditorLabels, meal: MealSlot, _dishes: Dish[]) {
  return `
    <div class="dish-suggestions" role="listbox" aria-label="${escapeHtml(labels.dishSuggestions)}" data-suggestion-list="${meal}" hidden></div>
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

function renderParticipantSelector(labels: DayEditorLabels, meal: MealSlot, mealData: MealEntry, participants: MenuParticipant[]) {
  if (!participants.length) return '';

  const selectedIds = new Set(getSelectedParticipantIds(mealData, participants));
  const legend = labels.participants ?? labels.membersTitle ?? labels.members ?? 'Participantes';
  const help = labels.participantsAll ?? labels.statusAll ?? 'Todos';

  return `
    <fieldset class="meal-participants" data-participant-list="${meal}">
      <legend>${escapeHtml(legend)}</legend>
      <p>${escapeHtml(help)}</p>
      <div class="meal-participants__grid">
        ${participants
          .map((participant) => {
            const name = getParticipantDisplayName(participant);
            return `
              <label class="meal-participant-chip">
                <input class="sr-only" type="checkbox" value="${escapeHtml(participant.id)}" ${selectedIds.has(participant.id) ? 'checked' : ''} data-participant-input="${meal}" />
                <span class="meal-participant-chip__avatar" aria-hidden="true">${escapeHtml(getParticipantInitials(participant))}</span>
                <span class="meal-participant-chip__name">${escapeHtml(name)}</span>
              </label>
            `;
          })
          .join('')}
      </div>
    </fieldset>
  `;
}

function renderMeal(labels: DayEditorLabels, meal: MealSlot, mealData: MealEntry, dishes: Dish[], participants: MenuParticipant[]) {
  const values = mealData.items.length ? mealData.items : [''];

  return `
    <section class="meal-editor day-edit-block" data-meal="${meal}">
      <header class="meal-editor__header">
        <div class="meal-editor__title">
          <h4>${escapeHtml(mealLabel(labels, meal))}</h4>
        </div>
        <button class="icon-button icon-button--primary meal-editor__add" type="button" data-add-plate="${meal}" aria-label="${escapeHtml(labels.addPlate)}">
          <span aria-hidden="true">+</span>
          <span>${escapeHtml(labels.addPlate)}</span>
        </button>
      </header>
      <div class="plate-list" data-plate-list="${meal}">
        ${values.map((value, index) => renderPlateRow(labels, meal, value, index, dishes)).join('')}
      </div>
      ${renderParticipantSelector(labels, meal, mealData, participants)}
    </section>
  `;
}

export function renderDayEditor(options: DayEditorOptions) {
  const { dayKey, dayNumber, weekday, dateLabel, day, enabledMeals, dishes, labels, participants = [], dailyOptions = [], compact = false } = options;
  const skipped = Boolean(day.skipped);
  const skipToggle = renderSkipToggle(labels, skipped);
  const dailyOptionsHtml = renderDailyOptions(labels, day, dailyOptions);
  const dailyOptionsCompactHtml = renderDailyOptions(labels, day, dailyOptions, true);
  const overviewBlock = `
    <section class="day-edit-overview">
      <header class="day-card__header">
        <div class="day-card__date-number">${escapeHtml(dayNumber)}</div>
        <div class="day-card__title"><h3>${escapeHtml(weekday)}</h3>${dateLabel ? `<p>${escapeHtml(dateLabel)}</p>` : ''}</div>
      </header>
      ${dailyOptionsCompactHtml ? `<div class="day-edit-overview__options">${dailyOptionsCompactHtml}</div>` : ''}
    </section>
  `;
  const editorBody = skipped
    ? `
      <div class="day-skipped-block" data-day-skipped-block>
        ${overviewBlock}
        ${skipToggle}
        ${renderReasonFields(labels, day.reason, day.skipNote)}
      </div>
    `
    : `
      <div class="day-meals-block" data-day-meals-block>
        ${overviewBlock}
        ${enabledMeals.map((meal) => renderMeal(labels, meal, day.meals[meal] ?? emptyMeal(), dishes, participants)).join('')}
        <label class="day-edit-field day-edit-field--textarea day-edit-block day-edit-notes">${escapeHtml(labels.notes)}
          <textarea data-field="notes" rows="3">${escapeHtml(day.notes ?? '')}</textarea>
        </label>
        ${skipToggle}
      </div>
    `;

  return `
    <article class="day-card day-card--editor ${compact ? 'day-card--compact-editor' : ''}" id="dia-${dayKey}" data-day="${dayKey}" data-day-mode="${skipped ? 'skipped' : 'meals'}">
      <div class="day-card__content day-edit-card__content">
        ${editorBody}
      </div>
    </article>
  `;
}
