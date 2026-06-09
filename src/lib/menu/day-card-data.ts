import { formatParticipantSummary } from './participants';
import { getSelectedDailyOptions } from './daily-options';
import type { DailyMenu, DailyOption, MealSlot, MenuParticipant, NoMealReason } from './types';

export type DayCardLabels = Record<string, string>;

export type PreparedDayMeal = {
  meal: MealSlot;
  label: string;
  summary: string;
  participantSummary: string;
};

const dailyOptionIconSymbols: Record<string, string> = {
  clock: '⏱️',
  utensils: '🍽️',
  kids: '👨‍👩‍👧',
  training: '🏃',
  'no-cook': '🥗',
  note: '📝',
};

function escapeHtml(value = '') {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function renderDailyOptionIcon(icon: string) {
  const symbol = dailyOptionIconSymbols[icon];
  return symbol ? `<span aria-hidden="true">${escapeHtml(symbol)}</span>` : '';
}

function reasonKey(reason: NoMealReason | '' | string) {
  if (reason === 'away') return 'reasonAway';
  if (reason === 'eating-out') return 'reasonEatingOut';
  if (reason === 'not-hungry') return 'reasonNotHungry';
  if (reason === 'other') return 'reasonOther';
  return '';
}

export function getDayCardMealLabel(labels: DayCardLabels, meal: MealSlot) {
  return labels[meal] ?? meal;
}

export function getDayCardReasonLabel(labels: DayCardLabels, reason: NoMealReason | '' | string = '') {
  const key = reasonKey(reason);
  return key ? labels[key] ?? '' : '';
}

export function getDayCardSkippedSummary(
  labels: DayCardLabels,
  dayReason: NoMealReason | '' | string = '',
  mealReason: NoMealReason | '' | string = '',
  fallback = ''
) {
  return getDayCardReasonLabel(labels, mealReason || dayReason) || fallback || labels.skipSummary || labels.noDay || labels.noMeal || labels.todayEmpty || '';
}

export function getDayCardMealSummary(labels: DayCardLabels, day: DailyMenu, meal: MealSlot) {
  if (day.skipped) {
    return getDayCardSkippedSummary(labels, day.reason, '', labels.noDay);
  }

  const mealState = day.meals[meal];
  if (mealState.skipped) {
    return getDayCardSkippedSummary(labels, '', mealState.reason, labels.noMeal);
  }

  return mealState.items.filter(Boolean).join(', ') || labels.todayEmpty || '';
}

export function getDayCardParticipantSummary(
  labels: DayCardLabels,
  day: DailyMenu,
  meal: MealSlot,
  participants: MenuParticipant[] = []
) {
  if (!participants.length || day.skipped) return '';
  return formatParticipantSummary(day.meals[meal], participants, labels);
}

export function prepareDayCardMeals(
  labels: DayCardLabels,
  day: DailyMenu,
  enabledMeals: MealSlot[],
  participants: MenuParticipant[] = []
): PreparedDayMeal[] {
  return enabledMeals.map((meal) => ({
    meal,
    label: getDayCardMealLabel(labels, meal),
    summary: getDayCardMealSummary(labels, day, meal),
    participantSummary: getDayCardParticipantSummary(labels, day, meal, participants),
  }));
}

export function prepareHistoryDayCardMeal(labels: DayCardLabels, meal: MealSlot, summary: string, participantSummary = ''): PreparedDayMeal {
  return {
    meal,
    label: getDayCardMealLabel(labels, meal),
    summary,
    participantSummary,
  };
}

export function renderDayCardMealsHtml(meals: PreparedDayMeal[]) {
  return meals
    .map((meal) => {
      const participantHtml = meal.participantSummary
        ? `<span class="meal-participants-summary">${escapeHtml(meal.participantSummary)}</span>`
        : '';

      return `
        <div class="day-meal-row">
          <span>${escapeHtml(meal.label)}</span>
          <strong>${escapeHtml(meal.summary)}</strong>
          ${participantHtml}
        </div>
      `;
    })
    .join('');
}

export function renderDayOptionBadgesHtml(day: DailyMenu, dailyOptions: DailyOption[], label = 'Day options') {
  const selected = getSelectedDailyOptions(day, dailyOptions);
  if (!selected.length) return '';

  return `
    <div class="day-option-badges" aria-label="${escapeHtml(label)}">
      ${selected
        .map((option) => `
          <span class="day-option-badge day-option-badge--${escapeHtml(option.color)}">
            ${renderDailyOptionIcon(option.icon)}
            ${escapeHtml(option.name)}
          </span>
        `)
        .join('')}
    </div>
  `;
}
