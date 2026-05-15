import type { Dish } from './types';

const suggestionLimit = 6;
let inputSequence = 0;

function escapeHtml(value = '') {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

function normalize(value = '') {
  return value
    .trim()
    .toLocaleLowerCase('es-ES')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function ensureInputId(input: HTMLInputElement) {
  if (!input.id) {
    inputSequence += 1;
    input.id = `dish-input-${Date.now()}-${inputSequence}`;
  }

  return input.id;
}

function getMatches(dishes: Dish[], query: string) {
  const normalizedQuery = normalize(query);

  return [...dishes]
    .map((dish) => {
      const normalizedName = normalize(dish.name);
      const startsWith = normalizedQuery ? normalizedName.startsWith(normalizedQuery) : false;
      const includes = normalizedQuery ? normalizedName.includes(normalizedQuery) : true;
      return { dish, startsWith, includes };
    })
    .filter((item) => item.includes)
    .sort((a, b) => {
      if (a.startsWith !== b.startsWith) return a.startsWith ? -1 : 1;
      return (b.dish.timesUsed ?? 0) - (a.dish.timesUsed ?? 0) || a.dish.name.localeCompare(b.dish.name);
    })
    .slice(0, suggestionLimit)
    .map((item) => item.dish);
}

function renderSuggestions(list: HTMLElement, input: HTMLInputElement, dishes: Dish[]) {
  const matches = getMatches(dishes, input.value);
  list.dataset.activeInputId = ensureInputId(input);

  if (!matches.length) {
    list.hidden = true;
    list.innerHTML = '';
    return;
  }

  list.innerHTML = matches
    .map(
      (dish) =>
        `<button type="button" role="option" data-suggestion="${escapeHtml(dish.name)}">${escapeHtml(dish.name)}</button>`
    )
    .join('');
  list.hidden = false;
}

export function attachDishSuggestions(root: HTMLElement, getDishes: () => Dish[]) {
  root.addEventListener('focusin', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.plateInput) return;

    const meal = input.dataset.plateInput;
    const mealSection = input.closest<HTMLElement>('[data-meal]');
    const list = mealSection?.querySelector<HTMLElement>(`[data-suggestion-list="${meal}"]`);
    if (!list) return;

    renderSuggestions(list, input, getDishes());
  });

  root.addEventListener('input', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.plateInput) return;

    const meal = input.dataset.plateInput;
    const mealSection = input.closest<HTMLElement>('[data-meal]');
    const list = mealSection?.querySelector<HTMLElement>(`[data-suggestion-list="${meal}"]`);
    if (!list) return;

    renderSuggestions(list, input, getDishes());
  });

  root.addEventListener('focusout', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.plateInput) return;

    window.setTimeout(() => {
      const mealSection = input.closest<HTMLElement>('[data-meal]');
      const list = mealSection?.querySelector<HTMLElement>('[data-suggestion-list]');
      if (list && !mealSection?.contains(document.activeElement)) {
        list.hidden = true;
      }
    }, 120);
  });

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest<HTMLButtonElement>('[data-suggestion]');
    if (!button) return;

    event.preventDefault();
    event.stopPropagation();

    const list = button.closest<HTMLElement>('[data-suggestion-list]');
    const inputId = list?.dataset.activeInputId;
    const input = inputId ? root.querySelector<HTMLInputElement>(`#${CSS.escape(inputId)}`) : null;

    if (!input) return;

    input.value = button.dataset.suggestion ?? '';
    input.dispatchEvent(new Event('change', { bubbles: true }));
    list.hidden = true;
  });
}
