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

function ensureListId(list: HTMLElement, input: HTMLInputElement) {
  if (!list.id) list.id = `${ensureInputId(input)}-listbox`;
  input.setAttribute('aria-controls', list.id);
}

function setExpanded(input: HTMLInputElement, isExpanded: boolean) {
  input.setAttribute('aria-expanded', String(isExpanded));
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

function hideSuggestions(list: HTMLElement, input?: HTMLInputElement | null) {
  list.hidden = true;
  list.innerHTML = '';
  if (input) setExpanded(input, false);
}

function renderSuggestions(list: HTMLElement, input: HTMLInputElement, dishes: Dish[]) {
  const matches = getMatches(dishes, input.value);
  list.dataset.activeInputId = ensureInputId(input);
  ensureListId(list, input);

  if (!matches.length) {
    hideSuggestions(list, input);
    return;
  }

  list.innerHTML = matches
    .map(
      (dish) =>
        `<button type="button" role="option" data-suggestion="${escapeHtml(dish.name)}">${escapeHtml(dish.name)}</button>`
    )
    .join('');
  list.hidden = false;
  setExpanded(input, true);
}

function getSuggestionTarget(input: HTMLInputElement) {
  const meal = input.dataset.plateInput;
  const mealSection = input.closest<HTMLElement>('[data-meal]');
  const list = mealSection?.querySelector<HTMLElement>(`[data-suggestion-list="${meal}"]`);

  return list ? { list, mealSection } : null;
}

function selectSuggestion(root: HTMLElement, button: HTMLButtonElement) {
  const list = button.closest<HTMLElement>('[data-suggestion-list]');
  const inputId = list?.dataset.activeInputId;
  const input = inputId ? root.querySelector<HTMLInputElement>(`#${CSS.escape(inputId)}`) : null;

  if (!input || !list) return;

  input.value = button.dataset.suggestion ?? '';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  hideSuggestions(list, input);
  input.focus();
}

export function attachDishSuggestions(root: HTMLElement, getDishes: () => Dish[]) {
  root.addEventListener('focusin', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.plateInput) return;

    const target = getSuggestionTarget(input);
    if (!target) return;

    renderSuggestions(target.list, input, getDishes());
  });

  root.addEventListener('input', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.plateInput) return;

    const target = getSuggestionTarget(input);
    if (!target) return;

    renderSuggestions(target.list, input, getDishes());
  });

  root.addEventListener('keydown', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.plateInput || event.key !== 'ArrowDown') return;

    const target = getSuggestionTarget(input);
    if (!target) return;

    event.preventDefault();
    renderSuggestions(target.list, input, getDishes());
    target.list.querySelector<HTMLButtonElement>('[data-suggestion]')?.focus();
  });

  root.addEventListener('focusout', (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || !input.dataset.plateInput) return;

    window.setTimeout(() => {
      const target = getSuggestionTarget(input);
      if (target && !target.mealSection?.contains(document.activeElement)) {
        hideSuggestions(target.list, input);
      }
    }, 120);
  });

  root.addEventListener('pointerdown', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const button = target.closest<HTMLButtonElement>('[data-suggestion]');
    if (!button) return;

    event.preventDefault();
    selectSuggestion(root, button);
  });

  root.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const toggle = target.closest<HTMLButtonElement>('[data-suggestion-toggle]');
    if (toggle) {
      const input = toggle.closest<HTMLElement>('.plate-row')?.querySelector<HTMLInputElement>('[data-plate-input]');
      const suggestionTarget = input ? getSuggestionTarget(input) : null;
      if (!input || !suggestionTarget) return;

      event.preventDefault();
      renderSuggestions(suggestionTarget.list, input, getDishes());
      input.focus();
      return;
    }
  });
}
